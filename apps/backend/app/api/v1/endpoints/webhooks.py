from __future__ import annotations

import json
import urllib.request

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.message import Message
from app.services.ses_outbound import record_ses_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# SES event publishing uses eventType; older SNS format may use notificationType.
# Map both to our message status.
_STATUS_MAP = {
    "Delivery": "delivered",
    "Open": "read",
    "Bounce": "failed",
    "Complaint": "failed",
    "Reject": "failed",
    "Send": "sent",
}

# Only advance status forward (queued→sent→delivered→read; never downgrade read→delivered)
_STATUS_RANK = {"queued": 0, "sent": 1, "delivered": 2, "read": 3, "failed": 99}


def _allowed_topic(arn: str) -> bool:
    """Check if the SNS TopicArn is in the allowed list (exact match after strip)."""
    normalized = (arn or "").strip()
    allowed = [a.strip() for a in settings.ses_events_sns_topic_arns.split(",") if a.strip()]
    return normalized in allowed


def _confirm_subscription(url: str) -> None:
    try:
        urllib.request.urlopen(url, timeout=10)  # noqa: S310
        logger.info("Confirmed SNS subscription for SES events")
    except Exception:
        logger.exception("Failed to confirm SNS subscription for SES events")


def _extract_email_message_id(headers: list[dict]) -> str | None:
    """Pull the raw Message-ID value out of the SES mail.headers list."""
    for h in headers:
        if h.get("name", "").lower() == "message-id":
            return h.get("value", "").strip().strip("<>") or None
    return None


def _extract_ses_tag(mail: dict, key: str) -> str | None:
    """Return the first SES mail.tags[key] value, if present."""
    tags = mail.get("tags") or {}
    value = tags.get(key) or tags.get(key.lower()) or tags.get(key.upper())
    if isinstance(value, list) and value:
        return str(value[0]).strip() or None
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _publish_message_status_updated(
    org_id: UUID,
    conversation_id: UUID,
    message_id: UUID,
    status: str,
) -> None:
    """Publish to Redis so WebSocket clients can push status to the frontend."""
    try:
        import redis as _sync_redis

        _r = _sync_redis.Redis.from_url(
            settings.redis_url, decode_responses=True, socket_timeout=1
        )
        _r.publish(
            settings.inbound_events_channel,
            json.dumps(
                {
                    "event_version": 1,
                    "event": "message_status_updated",
                    "org_id": str(org_id),
                    "conversation_id": str(conversation_id),
                    "message_id": str(message_id),
                    "status": status,
                }
            ),
        )
    except Exception:
        pass  # Non-critical; frontend will get status on next poll


@router.post("/ses-events", response_class=PlainTextResponse)
async def ses_events(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    body = await request.body()
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return "ok"

    msg_type = payload.get("Type", "")
    topic_arn = (payload.get("TopicArn") or "").strip()

    if not _allowed_topic(topic_arn) and settings.ses_events_sns_topic_arns:
        allowed = [a.strip() for a in settings.ses_events_sns_topic_arns.split(",") if a.strip()]
        logger.warning(
            "SES events webhook: rejected — TopicArn from SNS does not match SES_EVENTS_SNS_TOPIC_ARNS. "
            "Received: %r. Allowed: %s",
            topic_arn or "(empty)",
            allowed,
        )
        return "ok"

    logger.info("SES events webhook: processing %s event (→ %s)", msg_type, topic_arn)

    # ── Subscription confirmation ───────────────────────────────────────────
    if msg_type == "SubscriptionConfirmation":
        subscribe_url = payload.get("SubscribeURL")
        if subscribe_url:
            _confirm_subscription(subscribe_url)
        return "ok"

    # ── Event notification ──────────────────────────────────────────────────
    if msg_type != "Notification":
        return "ok"

    try:
        event = json.loads(payload.get("Message", "{}"))
    except json.JSONDecodeError:
        return "ok"

    # SES event publishing uses "eventType"; legacy/other SNS payloads may use "notificationType"
    notification_type: str = (
        (event.get("eventType") or event.get("notificationType")) or ""
    ).strip()
    new_status = _STATUS_MAP.get(notification_type)
    if not new_status:
        logger.info(
            "SES events webhook: skipping Notification — unknown or empty eventType/notificationType=%r (event keys: %s)",
            notification_type or "(empty)",
            list(event.keys()) if isinstance(event, dict) else "n/a",
        )
        return "ok"

    logger.info(
        "SES events webhook: processing %s event (→ %s)",
        notification_type,
        new_status,
    )
    mail = event.get("mail") or {}
    headers: list[dict] = mail.get("headers") or []

    # Prefer explicit SES message tags for mapping events back to ATS.
    tagged_message_id_str = _extract_ses_tag(mail, "message_id")
    tagged_org_id_str = _extract_ses_tag(mail, "org_id")

    # ── 1) Try to update by explicit ATS message_id tag ───────────────────────
    if tagged_message_id_str:
        try:
            tagged_message_id = UUID(tagged_message_id_str)
        except (ValueError, TypeError):
            tagged_message_id = None
            logger.warning(
                "SES events webhook: invalid message_id tag %r in %s event",
                tagged_message_id_str,
                notification_type,
            )
        if tagged_message_id is not None:
            try:
                result = await db.execute(
                    select(
                        Message.id,
                        Message.status,
                        Message.org_id,
                        Message.conversation_id,
                    ).where(Message.id == tagged_message_id)
                )
                row = result.first()
                if row is None:
                    logger.info(
                        "SES events webhook: no message found for tagged message_id=%s (event=%s)",
                        tagged_message_id_str,
                        notification_type,
                    )
                else:
                    if tagged_org_id_str and str(row.org_id) != tagged_org_id_str:
                        logger.warning(
                            "SES events webhook: org mismatch for message_id=%s (row_org_id=%s, tag_org_id=%s)",
                            tagged_message_id_str,
                            row.org_id,
                            tagged_org_id_str,
                        )
                    else:
                        current_rank = _STATUS_RANK.get(row.status, 0)
                        new_rank = _STATUS_RANK.get(new_status, 0)
                        if new_rank > current_rank:
                            await db.execute(
                                sa_update(Message)
                                .where(Message.id == row.id)
                                .values(status=new_status)
                            )
                            await db.commit()
                            logger.info(
                                "SES events: (tags) message %s → %s (was %s)",
                                row.id,
                                new_status,
                                row.status,
                            )
                            _publish_message_status_updated(
                                row.org_id,
                                row.conversation_id,
                                row.id,
                                new_status,
                            )
                        # Record reputation metrics for this org
                        await record_ses_event(db, row.org_id, notification_type)
                        return "ok"
            except Exception:
                logger.exception(
                    "SES events webhook: failed to update message for tagged message_id=%s",
                    tagged_message_id_str,
                )
                return "ok"

    # ── 2) Fallback: match by SES mail.messageId or Message-ID header ────────
    ses_message_id = (mail.get("messageId") or "").strip() or None
    email_message_id = _extract_email_message_id(headers)

    if not ses_message_id and not email_message_id:
        logger.info(
            "SES events webhook: no messageId/Message-ID or usable message_id tag in %s event — cannot update status",
            notification_type,
        )
        return "ok"

    try:
        # When sending via SES API we store SES MessageId; try it first (exact match)
        row = None
        if ses_message_id:
            result = await db.execute(
                select(
                    Message.id,
                    Message.status,
                    Message.org_id,
                    Message.conversation_id,
                ).where(Message.email_message_id == ses_message_id)
            )
            row = result.first()
        if row is None and email_message_id:
            result = await db.execute(
                select(
                    Message.id,
                    Message.status,
                    Message.org_id,
                    Message.conversation_id,
                ).where(
                    Message.email_message_id.isnot(None),
                    func.lower(Message.email_message_id) == email_message_id.lower(),
                )
            )
            row = result.first()
        if row is None:
            logger.info(
                "SES events webhook: no message found for ses_message_id=%s email_message_id=%s (event=%s)",
                ses_message_id,
                email_message_id,
                notification_type,
            )
            return "ok"

        current_rank = _STATUS_RANK.get(row.status, 0)
        new_rank = _STATUS_RANK.get(new_status, 0)

        if new_rank > current_rank:
            await db.execute(
                sa_update(Message)
                .where(Message.id == row.id)
                .values(status=new_status)
            )
            await db.commit()
            logger.info(
                "SES events: message %s → %s (was %s)", row.id, new_status, row.status
            )
            _publish_message_status_updated(
                row.org_id,
                row.conversation_id,
                row.id,
                new_status,
            )
        await record_ses_event(db, row.org_id, notification_type)
    except Exception:
        logger.exception(
            "SES events webhook: failed to update message for ses_message_id=%s",
            ses_message_id,
        )

    return "ok"
