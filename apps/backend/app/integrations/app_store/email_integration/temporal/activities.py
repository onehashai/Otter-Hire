from __future__ import annotations

import asyncio
import base64
import json
from urllib.error import URLError
from uuid import UUID

import boto3
import redis
from sqlalchemy import update as sa_update
from temporalio import activity

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.integrations.app_store.email_integration.ses_bridge import (
    _extract_text_and_attachments,
    _mark_key_ignored_in_redis,
    _post_to_inbound_api,
    _resolve_inbox_context,
)
from app.integrations.app_store.email_integration.temporal.types import (
    InboundWorkflowInput,
    OutboundWorkflowInput,
)
from app.core.logging import logger
from app.models.message import Message


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

    secret, canonical_inbox_address, reply_to_conv_id = inbox_context
    payload = {
        "inbox_address": canonical_inbox_address,
        "reply_to_conversation_id": reply_to_conv_id,
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
async def download_and_extract_resume_activity(input_data: InboundWorkflowInput) -> dict:
    if "AMAZON_SES_SETUP_NOTIFICATION" in input_data.key:
        return {"status": "ignored", "reason": "setup_notification"}

    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_s3_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    raw_email = await asyncio.to_thread(
        lambda: s3_client.get_object(Bucket=input_data.bucket, Key=input_data.key)["Body"].read()
    )
    normalized = _extract_text_and_attachments(raw_email)
    inbox_address = normalized.get("inbox_address")
    if not inbox_address:
        return {"status": "ignored", "reason": "missing_recipient"}

    inbox_context = await _resolve_inbox_context(inbox_address)
    if not inbox_context:
        return {"status": "ignored", "reason": "inbox_or_secret_not_found", "inbox": inbox_address}

    secret, canonical_inbox_address, reply_to_conv_id = inbox_context
    payload = {
        "inbox_address": canonical_inbox_address,
        "reply_to_conversation_id": reply_to_conv_id,
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
async def process_s3_inbound_email_activity(input_data: InboundWorkflowInput) -> dict:
    extracted = await download_and_extract_resume_activity(input_data)
    return await parse_and_create_candidate_activity({"data": extracted, "key": input_data.key})


@activity.defn
async def parse_and_create_candidate_activity(input_data: dict) -> dict:
    data = input_data.get("data") or {}
    key = str(input_data.get("key") or "")
    if data.get("status") != "ready":
        # Workflow completed without creating an InboundEmail DB record (unknown inbox,
        # bad format, etc.).  Mark the key as permanently ignored in Redis so the
        # polling loop never re-enqueues it after the short-lived 'enqueued' TTL expires.
        if key:
            _mark_key_ignored_in_redis(key)
        return data

    payload = dict(data["payload"])
    payload["raw_storage_key"] = key
    status, response_text = await asyncio.to_thread(_post_to_inbound_api, payload, data["secret"])

    parsed_response: dict = {}
    try:
        loaded = json.loads(response_text)
        if isinstance(loaded, dict):
            parsed_response = loaded
    except Exception:
        parsed_response = {}

    result = {
        "status": "ok" if status < 400 else "error",
        "http_status": status,
        "inbox_address": data.get("canonical_inbox_address"),
        "key": key,
        "response_text": response_text,
        "candidate_id": parsed_response.get("candidate_id"),
        "inbound_email_id": parsed_response.get("inbound_email_id"),
        "org_id": parsed_response.get("org_id"),
    }
    if status >= 400:
        raise URLError(f"Inbound API failed status={status} body={response_text}")
    return result


@activity.defn
async def publish_update_activity(event_payload: dict) -> None:
    event_payload = {
        "event_version": 1,
        **event_payload,
    }
    redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    redis_client.publish(settings.inbound_events_channel, json.dumps(event_payload))

@activity.defn
async def send_outbound_email_activity(input_data: OutboundWorkflowInput) -> dict:
    """Send one outbound email via SES (org-level identity; from address from config or env).

    Raises on send error so Temporal will retry. Message row stays ``queued`` until success.
    """
    from app.integrations.app_store.email_integration.outbound_service import (
        get_verified_outbound_for_org,
    )
    from app.services.ses_outbound import send_email_via_ses

    org_id = UUID(input_data.org_id)
    message_id = UUID(input_data.message_id)

    async with AsyncSessionLocal() as db:
        # Prefer reply+conv@inbound.domain as From so replies land in the same conversation
        reply_as_from = (input_data.reply_to or "").strip()
        if reply_as_from and "@" in reply_as_from:
            from_email_addr = reply_as_from
            if input_data.org_name:
                display_name = f"{input_data.from_name or 'Recruiter'} from {input_data.org_name}"
            else:
                # Never use the reply+ address as display name; use name or "Recruiter"
                display_name = (input_data.from_name or "Recruiter").strip() or "Recruiter"
        else:
            outbound_row = await get_verified_outbound_for_org(db, org_id)
            if outbound_row is not None:
                cfg = outbound_row.config or {}
                from_email_addr = (cfg.get("from_email") or "").strip()
                from_name_val = cfg.get("from_name")
            else:
                from_email_addr = ""
                from_name_val = None

            if not from_email_addr or "@" not in from_email_addr:
                await db.execute(
                    sa_update(Message).where(Message.id == message_id).values(status="failed")
                )
                await db.commit()
                return {"status": "failed", "reason": "no_outbound_configured"}

            display_name = input_data.from_name or from_name_val or from_email_addr

        html_body = input_data.html_body

        ses_message_id = send_email_via_ses(
            from_email=from_email_addr,
            from_name=display_name,
            to_email=input_data.to_email,
            subject=input_data.subject,
            text_body=input_data.body,
            html_body=html_body,
            reply_to=None,
            in_reply_to=input_data.in_reply_to,
            references=input_data.references,
            message_id_tag=input_data.message_id,
            org_id_tag=input_data.org_id,
        )
        provider_message_id = f"ses:{ses_message_id}"

        await db.execute(
            sa_update(Message)
            .where(Message.id == message_id)
            .values(
                status="sent",
                provider_message_id=provider_message_id,
                email_message_id=ses_message_id,
            )
        )
        await db.commit()

    return {
        "status": "sent",
        "message_id": input_data.message_id,
        "provider_message_id": provider_message_id,
    }


@activity.defn
async def mark_message_failed_activity(message_id: str) -> None:
    """Flip a message to 'failed' after all send retries are exhausted."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            sa_update(Message).where(Message.id == UUID(message_id)).values(status="failed")
        )
        await db.commit()
