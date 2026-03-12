from __future__ import annotations

import asyncio
import base64
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import make_msgid
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
    activity.logger.info(
        "Inbound extract start bucket=%s key=%s",
        input_data.bucket,
        input_data.key,
    )
    if "AMAZON_SES_SETUP_NOTIFICATION" in input_data.key:
        activity.logger.info(
            "Inbound extract ignored key=%s reason=%s",
            input_data.key,
            "setup_notification",
        )
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
        activity.logger.info(
            "Inbound extract ignored key=%s reason=%s",
            input_data.key,
            "missing_recipient",
        )
        return {"status": "ignored", "reason": "missing_recipient"}

    inbox_context = await _resolve_inbox_context(inbox_address)
    if not inbox_context:
        activity.logger.info(
            "Inbound extract ignored key=%s reason=%s inbox=%s",
            input_data.key,
            "inbox_or_secret_not_found",
            inbox_address,
        )
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
    result = {
        "status": "ready",
        "secret": secret,
        "canonical_inbox_address": canonical_inbox_address,
        "payload": payload,
    }
    activity.logger.info(
        "Inbound extract ready key=%s inbox=%s from_email=%s subject=%s attachments=%s",
        input_data.key,
        canonical_inbox_address,
        payload.get("from_email"),
        payload.get("subject"),
        len(payload.get("attachments") or []),
    )
    return result


@activity.defn
async def process_s3_inbound_email_activity(input_data: InboundWorkflowInput) -> dict:
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info(
            "Inbound activity start bucket=%s key=%s activity=%s",
            input_data.bucket,
            input_data.key,
            "process_s3_inbound_email_activity",
        )
        extracted = await download_and_extract_resume_activity(input_data)
        logger.info(
            "Inbound activity extracted key=%s status=%s inbox=%s reason=%s",
            input_data.key,
            extracted.get("status"),
            extracted.get("canonical_inbox_address") or extracted.get("inbox"),
            extracted.get("reason"),
        )
        result = await parse_and_create_candidate_activity({"data": extracted, "key": input_data.key})
        logger.info(
            "Inbound activity parse completed key=%s status=%s http_status=%s inbound_email_id=%s candidate_id=%s",
            input_data.key,
            result.get("status"),
            result.get("http_status"),
            result.get("inbound_email_id"),
            result.get("candidate_id"),
        )
        return result
    except Exception as e:
        logger.error(
            "Inbound activity failed key=%s error_type=%s error=%s",
            input_data.key,
            type(e).__name__,
            e,
            exc_info=True,
        )
        raise


@activity.defn
async def parse_and_create_candidate_activity(input_data: dict) -> dict:
    data = input_data.get("data") or {}
    key = str(input_data.get("key") or "")
    if data.get("status") != "ready":
        # Workflow completed without creating an InboundEmail DB record (unknown inbox,
        # bad format, etc.).  Mark the key as permanently ignored in Redis so the
        # polling loop never re-enqueues it after the short-lived 'enqueued' TTL expires.
        activity.logger.info(
            "Inbound activity short-circuit key=%s status=%s reason=%s inbox=%s",
            key,
            data.get("status"),
            data.get("reason"),
            data.get("canonical_inbox_address") or data.get("inbox"),
        )
        if key:
            _mark_key_ignored_in_redis(key)
        return data

    payload = dict(data["payload"])
    payload["raw_storage_key"] = key
    activity.logger.info(
        "Inbound activity posting to API key=%s inbox=%s from_email=%s subject=%s",
        key,
        payload.get("inbox_address"),
        payload.get("from_email"),
        payload.get("subject"),
    )
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
    activity.logger.info(
        "Inbound activity API response key=%s http_status=%s inbound_email_id=%s candidate_id=%s",
        key,
        status,
        result.get("inbound_email_id"),
        result.get("candidate_id"),
    )
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


# ---------------------------------------------------------------------------
# Outbound email activities
# ---------------------------------------------------------------------------


@activity.defn
async def send_outbound_email_activity(input_data: OutboundWorkflowInput) -> dict:
    """Send one outbound email via the org's SMTP config and mark it as 'sent' in the DB.

    Raises on any SMTP error so Temporal will retry according to the workflow's
    RetryPolicy.  The message row stays ``queued`` until success.
    """
    from app.integrations.app_store.email_integration.smtp_service import (
        decrypt_password_for_sending,
        get_verified_smtp_for_org,
    )

    org_id = UUID(input_data.org_id)
    message_id = UUID(input_data.message_id)

    async with AsyncSessionLocal() as db:
        smtp_row = await get_verified_smtp_for_org(db, org_id)
        if smtp_row is None:
            # No active SMTP — permanently fail without retrying.
            await db.execute(
                sa_update(Message).where(Message.id == message_id).values(status="failed")
            )
            await db.commit()
            return {"status": "failed", "reason": "no_smtp_configured"}

        cfg = smtp_row.config or {}
        host: str = cfg.get("host", "")
        port: int = cfg.get("port", 587)
        display_name: str = (
            input_data.from_name or cfg.get("from_name") or cfg.get("from_email", "")
        )
        from_email_addr: str = cfg.get("from_email", "")
        plain_password: str = decrypt_password_for_sending(smtp_row)

        # Optionally inject a self-hosted open-tracking pixel into the HTML body.
        html_body = input_data.html_body
        tracking_secret = settings.email_tracking_secret
        tracking_base = f"{settings.effective_frontend_base_url}/api"
        if html_body and tracking_secret:
            from app.api.v1.endpoints.track import make_tracking_token

            token = make_tracking_token(input_data.message_id, tracking_secret)
            pixel_url = f"{tracking_base}/public/track/open/{input_data.message_id}/{token}"
            pixel_html = (
                f'<img src="{pixel_url}" width="1" height="1" '
                f'style="display:none;border:0" alt="">'
            )
            close_tag = "</body>"
            idx = html_body.lower().rfind(close_tag)
            if idx != -1:
                html_body = html_body[:idx] + pixel_html + html_body[idx:]
            else:
                html_body = html_body + pixel_html

        # Build the MIME message before entering the thread
        mime_msg = MIMEMultipart("alternative")
        mime_msg["Message-ID"] = make_msgid(domain=host or "localhost")
        mime_msg["Subject"] = input_data.subject
        mime_msg["From"] = f"{display_name} <{from_email_addr}>"
        mime_msg["To"] = input_data.to_email
        if input_data.reply_to:
            mime_msg["Reply-To"] = input_data.reply_to
        # X-SES-Configuration-Set enables Delivery/Open/Bounce event publishing via SNS
        if settings.ses_configuration_set:
            mime_msg["X-SES-Configuration-Set"] = settings.ses_configuration_set
        mime_msg.attach(MIMEText(input_data.body, "plain"))
        if html_body:
            mime_msg.attach(MIMEText(html_body, "html"))

        raw_message_id: str = (mime_msg["Message-ID"] or "").strip().strip("<>")
        provider_message_id = f"smtp:{host}:{raw_message_id}"

        # smtplib is blocking — run in a thread so the event loop stays free
        use_ssl: bool = bool(cfg.get("use_ssl"))
        use_tls: bool = bool(cfg.get("use_tls"))
        username: str = cfg.get("username", "")

        def _do_send() -> None:
            if use_ssl:
                with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                    server.login(username, plain_password)
                    server.send_message(mime_msg)
            else:
                with smtplib.SMTP(host, port, timeout=30) as server:
                    if use_tls:
                        server.starttls()
                    server.login(username, plain_password)
                    server.send_message(mime_msg)

        # Raises on any SMTP error → Temporal will retry
        await asyncio.to_thread(_do_send)

        # Success — persist the confirmed IDs and flip status
        await db.execute(
            sa_update(Message)
            .where(Message.id == message_id)
            .values(
                status="sent",
                provider_message_id=provider_message_id,
                email_message_id=raw_message_id,
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
