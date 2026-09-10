from __future__ import annotations

import asyncio
import logging

import httpx

from app.core.config import settings
from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)


async def _process_message(client: httpx.AsyncClient, message: dict) -> None:
    message_id = str(message.get("ID") or "")
    if not message_id:
        return
    redis = get_redis_client()
    marker = f"ats:local-mailpit:processed:{message_id}"
    if await redis.get(marker):
        return
    detail = (await client.get(f"{settings.local_mailpit_url}/api/v1/message/{message_id}")).json()
    recipients = detail.get("To") or []
    for recipient in recipients:
        inbox = (recipient.get("Address") or "").strip().lower()
        if not inbox:
            continue
        payload = {
            "inbox_address": inbox,
            "from_email": (detail.get("From") or {}).get("Address"),
            "from_name": (detail.get("From") or {}).get("Name"),
            "subject": detail.get("Subject"),
            "message_id": detail.get("MessageID") or message_id,
            "text_body": detail.get("Text") or "",
            "html_body": detail.get("HTML") or None,
        }
        response = await client.post(
            f"{settings.backend_url.rstrip('/')}/v1/internal/inbound/email",
            json=payload,
            headers={"X-Local-Mailpit": "1", "X-OneHash-Signature": "local-mailpit"},
        )
        if response.status_code in {200, 201, 404, 422}:
            await redis.set(marker, "1", ex=7 * 24 * 60 * 60)
            logger.info("Local Mailpit message %s processed for inbox=%s status=%s", message_id, inbox, response.status_code)
            break
        logger.warning("Local Mailpit message %s rejected status=%s body=%s", message_id, response.status_code, response.text[:200])


async def run_local_mailpit_bridge(stop_event: asyncio.Event) -> None:
    if settings.is_production or not settings.local_mailpit_enabled:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        while not stop_event.is_set():
            try:
                response = await client.get(f"{settings.local_mailpit_url}/api/v1/messages", params={"limit": 100})
                response.raise_for_status()
                for message in response.json().get("messages", []):
                    await _process_message(client, message)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Local Mailpit bridge poll failed")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=settings.local_mailpit_poll_seconds)
            except asyncio.TimeoutError:
                pass
