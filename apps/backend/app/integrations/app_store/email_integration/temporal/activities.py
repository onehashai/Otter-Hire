from __future__ import annotations

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from urllib.error import URLError
from uuid import UUID

from temporalio import activity

from app.core.config import settings
from app.integrations.app_store.email_integration.temporal.types import (
    InboundWorkflowInput,
    OutboundWorkflowInput,
)

logger = logging.getLogger("ats_worker")


def _get_redis_client():
    import redis

    return redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True,
    )


@activity.defn(name="download_email_activity")
async def download_email_activity(input_data: InboundWorkflowInput) -> str:
    import boto3

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


@activity.defn(name="extract_resume_activity")
async def extract_resume_activity(raw_email_b64: str) -> dict:
    from app.integrations.app_store.email_integration.ses_bridge import (
        _extract_text_and_attachments,
        _resolve_inbox_context,
    )

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


@activity.defn(name="download_and_extract_resume_activity")
async def download_and_extract_resume_activity(input_data: InboundWorkflowInput) -> dict:
    import boto3

    from app.integrations.app_store.email_integration.ses_bridge import (
        _extract_text_and_attachments,
        _resolve_inbox_context,
    )

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


@activity.defn(name="process_s3_inbound_email_activity")
async def process_s3_inbound_email_activity(input_data: InboundWorkflowInput) -> dict:
    ctx = activity.info()
    logger.info(
        "Activity started: process_s3_inbound_email bucket=%s key=%s workflow_id=%s",
        input_data.bucket,
        input_data.key,
        ctx.workflow_id,
    )
    try:
        extracted = await download_and_extract_resume_activity(input_data)
        result = await parse_and_create_candidate_activity(
            {"data": extracted, "key": input_data.key}
        )
        logger.info(
            "Activity completed: process_s3_inbound_email key=%s status=%s workflow_id=%s",
            input_data.key,
            result.get("status"),
            ctx.workflow_id,
        )
        return result
    except Exception as e:
        logger.exception(
            "Activity failed: process_s3_inbound_email key=%s workflow_id=%s error=%s",
            input_data.key,
            ctx.workflow_id,
            e,
        )
        raise


@activity.defn(name="parse_and_create_candidate_activity")
async def parse_and_create_candidate_activity(input_data: dict) -> dict:
    from app.integrations.app_store.email_integration.ses_bridge import (
        _mark_key_ignored_in_redis,
        _post_to_inbound_api,
    )

    data = input_data.get("data") or {}
    key = str(input_data.get("key") or "")
    logger.info(
        "Activity: parse_and_create_candidate key=%s status=%s",
        key,
        data.get("status"),
    )

    if data.get("status") != "ready":
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

    logger.info(
        "Activity: parse_and_create_candidate done key=%s http_status=%s candidate_id=%s",
        key,
        status,
        parsed_response.get("candidate_id"),
    )

    if status >= 400:
        raise URLError(f"Inbound API failed status={status} body={response_text}")

    return result


@activity.defn(name="publish_update_activity")
async def publish_update_activity(event_payload: dict) -> None:
    try:
        redis_client = _get_redis_client()
        enriched_payload = {
            "event_version": 1,
            "occurred_at": datetime.now(tz=timezone.utc).isoformat(),
            **event_payload,
        }

        await asyncio.to_thread(
            redis_client.publish,
            settings.inbound_events_channel,
            json.dumps(enriched_payload),
        )

        logger.info(
            "Published inbound event channel=%s event=%s workflow_id=%s",
            settings.inbound_events_channel,
            enriched_payload.get("event"),
            enriched_payload.get("workflow_id"),
        )

    except Exception:
        logger.exception(
            "Failed to publish inbound event event=%s workflow_id=%s",
            event_payload.get("event"),
            event_payload.get("workflow_id"),
        )
        raise


@activity.defn(name="send_outbound_email_activity")
async def send_outbound_email_activity(input_data: OutboundWorkflowInput) -> dict:
    from sqlalchemy import update as sa_update

    from app.db.session import AsyncSessionLocal
    from app.integrations.app_store.email_integration.outbound_service import (
        get_verified_outbound_for_org,
    )
    from app.models.message import Message
    from app.services.ses_outbound import send_email_via_ses

    logger.info(
        "Activity started: send_outbound_email message_id=%s to=%s",
        input_data.message_id,
        input_data.to_email,
    )

    org_id = UUID(input_data.org_id)
    message_id = UUID(input_data.message_id)

    async with AsyncSessionLocal() as db:
        reply_as_from = (input_data.reply_to or "").strip()
        if reply_as_from and "@" in reply_as_from:
            from_email_addr = reply_as_from
            if input_data.org_name:
                display_name = f"{input_data.from_name or 'Recruiter'} from {input_data.org_name}"
            else:
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

        ses_message_id = await asyncio.to_thread(
            send_email_via_ses,
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

    logger.info(
        "Activity completed: send_outbound_email message_id=%s status=sent",
        input_data.message_id,
    )

    return {
        "status": "sent",
        "message_id": input_data.message_id,
        "provider_message_id": provider_message_id,
    }


@activity.defn(name="mark_message_failed_activity")
async def mark_message_failed_activity(message_id: str) -> None:
    from sqlalchemy import update as sa_update

    from app.db.session import AsyncSessionLocal
    from app.models.message import Message

    logger.warning("Activity: mark_message_failed message_id=%s", message_id)

    async with AsyncSessionLocal() as db:
        await db.execute(
            sa_update(Message).where(Message.id == UUID(message_id)).values(status="failed")
        )
        await db.commit()
