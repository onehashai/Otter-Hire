from __future__ import annotations

import asyncio
import base64
import json
from urllib.error import URLError

import boto3
import redis
from temporalio import activity

from app.core.config import settings
from app.services.ses_bridge import _extract_text_and_attachments, _post_to_inbound_api, _resolve_inbox_context
from app.workflows.types import InboundWorkflowInput


@activity.defn
async def download_email_activity(input_data: InboundWorkflowInput) -> str:
    if "AMAZON_SES_SETUP_NOTIFICATION" in input_data.key:
        return json.dumps({"status": "ignored", "reason": "setup_notification"})

    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_s3_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    raw_email = await asyncio.to_thread(
        lambda: s3_client.get_object(Bucket=input_data.bucket, Key=input_data.key)["Body"].read()
    )
    return base64.b64encode(raw_email).decode("ascii")


@activity.defn
async def extract_resume_activity(raw_email_b64: str) -> dict:
    if raw_email_b64.startswith("{"):
        parsed = json.loads(raw_email_b64)
        if parsed.get("status") == "ignored":
            return parsed

    raw_email = base64.b64decode(raw_email_b64.encode("ascii"))
    normalized = _extract_text_and_attachments(raw_email)
    inbox_address = normalized.get("inbox_address")
    if not inbox_address:
        return {"status": "ignored", "reason": "missing_recipient"}

    inbox_context = await _resolve_inbox_context(inbox_address)
    if not inbox_context:
        return {"status": "ignored", "reason": "inbox_or_secret_not_found", "inbox": inbox_address}

    secret, canonical_inbox_address = inbox_context
    payload = {
        "inbox_address": canonical_inbox_address,
        "from_email": normalized.get("from_email"),
        "subject": normalized.get("subject"),
        "message_id": normalized.get("message_id"),
        "raw_storage_key": None,
        "text_body": normalized.get("text_body") or None,
        "html_body": normalized.get("html_body") or None,
        "attachments": normalized.get("attachments") or [],
    }
    return {
        "status": "ready",
        "secret": secret,
        "canonical_inbox_address": canonical_inbox_address,
        "payload": payload,
    }


@activity.defn
async def parse_and_create_candidate_activity(input_data: dict) -> dict:
    data = input_data.get("data") or {}
    key = str(input_data.get("key") or "")
    if data.get("status") != "ready":
        return data

    payload = dict(data["payload"])
    payload["raw_storage_key"] = key
    status, response_text = await asyncio.to_thread(_post_to_inbound_api, payload, data["secret"])

    result = {
        "status": "ok" if status < 400 else "error",
        "http_status": status,
        "inbox_address": data.get("canonical_inbox_address"),
        "key": key,
        "response_text": response_text,
    }
    if status >= 400:
        raise URLError(f"Inbound API failed status={status} body={response_text}")
    return result


@activity.defn
async def publish_update_activity(event_payload: dict) -> None:
    redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    redis_client.publish(settings.inbound_events_channel, json.dumps(event_payload))
