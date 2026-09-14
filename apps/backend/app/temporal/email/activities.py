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
from app.temporal.email.types import (
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

    ses_endpoint = None if (settings.s3_endpoint_url and "cloudflarestorage.com" in settings.s3_endpoint_url) else settings.s3_endpoint_url
    ses_region = "ap-south-1" if (not settings.aws_s3_region or settings.aws_s3_region == "auto") else settings.aws_s3_region
    ses_access_key = settings.aws_ses_access_key or settings.aws_access_key_id
    ses_secret_key = settings.aws_ses_secret_key or settings.aws_secret_access_key

    s3_client = boto3.client(
        "s3",
        region_name=ses_region,
        aws_access_key_id=ses_access_key,
        aws_secret_access_key=ses_secret_key,
        endpoint_url=ses_endpoint,
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

    ses_endpoint = None if (settings.s3_endpoint_url and "cloudflarestorage.com" in settings.s3_endpoint_url) else settings.s3_endpoint_url
    ses_region = "ap-south-1" if (not settings.aws_s3_region or settings.aws_s3_region == "auto") else settings.aws_s3_region
    ses_access_key = settings.aws_ses_access_key or settings.aws_access_key_id
    ses_secret_key = settings.aws_ses_secret_key or settings.aws_secret_access_key

    s3_client = boto3.client(
        "s3",
        region_name=ses_region,
        aws_access_key_id=ses_access_key,
        aws_secret_access_key=ses_secret_key,
        endpoint_url=ses_endpoint,
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
    from sqlalchemy import select
    from sqlalchemy import update as sa_update

    from app.db.session import AsyncSessionLocal
    from app.integrations.app_store.email_integration.outbound_service import (
        get_verified_outbound_for_org,
    )
    from app.models.message import Message
    from app.services.email._factory import get_platform_provider

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
            mail_domain = (settings.SES_MAIL_DOMAIN or "smartats.in").strip().lstrip("@")
            from_email_addr = f"noreply@{mail_domain}"
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
                if not settings.is_production:
                    from_email_addr = settings.local_smtp_from
                    from_name_val = settings.platform_name
                else:
                    await db.execute(
                        sa_update(Message).where(Message.id == message_id).values(status="failed")
                    )
                    await db.commit()
                    return {"status": "failed", "reason": "no_outbound_configured"}

            display_name = input_data.from_name or from_name_val or from_email_addr

        html_body = input_data.html_body

        # Download attachment bytes from S3 if present
        from app.services.storage import storage_service

        resolved_attachments: list[dict] = []
        temp_s3_keys: list[str] = []  # keys to delete after successful send
        for att in input_data.attachments or []:
            s3_key = att.get("s3_key", "")
            if not s3_key:
                continue
            try:
                content = await storage_service.read_bytes(s3_key)
                resolved_attachments.append(
                    {
                        "filename": att.get("filename", "attachment"),
                        "mime_type": att.get("mime_type", "application/octet-stream"),
                        "content": content,
                    }
                )
                if "/temp/" in s3_key:
                    temp_s3_keys.append(s3_key)
            except Exception:
                logger.exception(
                    "Activity: failed to download attachment s3_key=%s message_id=%s",
                    s3_key,
                    input_data.message_id,
                )

        # Build References header chain for proper email threading
        references_header = input_data.references
        if input_data.conversation_id:
            result = await db.execute(
                select(Message.email_message_id)
                .where(
                    Message.conversation_id == UUID(input_data.conversation_id),
                    Message.email_message_id.isnot(None),
                    Message.id != message_id,
                )
                .order_by(Message.created_at)
            )
            previous_message_ids = [row[0] for row in result.fetchall()]
            if previous_message_ids:
                references_header = " ".join([f"<{mid}>" for mid in previous_message_ids])

        provider = get_platform_provider()
        send_result = await provider.send_conversation(
            from_email=from_email_addr,
            from_name=display_name,
            to_email=input_data.to_email,
            subject=input_data.subject,
            text_body=input_data.body,
            html_body=html_body,
            in_reply_to=input_data.in_reply_to,
            references=references_header,
            message_id_tag=input_data.message_id,
            org_id_tag=input_data.org_id,
            attachments=resolved_attachments,
        )

        provider_message_id = send_result.provider_message_id

        result = await db.execute(
            sa_update(Message)
            .where(Message.id == message_id)
            .values(
                status="sent",
                provider_message_id=provider_message_id,
                email_message_id=send_result.email_message_id,
            )
        )
        await db.commit()

        if result.rowcount == 0:
            logger.error(
                "Activity failed: send_outbound_email message_id=%s - message not found in database after sending email",
                input_data.message_id,
            )
            raise RuntimeError(f"Message {message_id} not found in database after sending email")

        # Clean up temp attachment files from S3 now that email is sent
        for s3_key in temp_s3_keys:
            try:
                await storage_service.delete_object(s3_key)
                logger.info(
                    "Deleted temp attachment s3_key=%s message_id=%s", s3_key, input_data.message_id
                )
            except Exception:
                logger.warning("Failed to delete temp attachment s3_key=%s (non-fatal)", s3_key)

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
