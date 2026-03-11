"""
Webhooks for SES outbound event notifications (Delivery, Open, Bounce, Complaint).

AWS SES publishes these events to SNS, which HTTP-POSTs them here.

Setup required on the AWS side:
  1. Create (or reuse) an SES Configuration Set.
  2. Add an SNS event destination on that configuration set for the events you
     want: Delivery, Open (requires open tracking to be enabled on the config
     set), Bounce, Complaint.
  3. Subscribe this endpoint URL to the SNS topic:
       POST https://<your-api-host>/webhooks/ses-events
  4. Set the env vars:
       SES_CONFIGURATION_SET=<name>
       SES_EVENTS_SNS_TOPIC_ARNS=<topic-arn>[,<topic-arn2>,...]

Event → status mapping
  Delivery  → 'delivered'
  Open      → 'read'
  Bounce    → 'failed'    (permanent or transient hard bounce)
  Complaint → 'failed'    (spam report)
"""

from __future__ import annotations

import json
import urllib.request

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.message import Message
from fastapi import Depends

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STATUS_MAP = {
    "Delivery": "delivered",
    "Open": "read",
    "Bounce": "failed",
    "Complaint": "failed",
}

# Only advance status forward (queued→sent→delivered→read; never downgrade read→delivered)
_STATUS_RANK = {"queued": 0, "sent": 1, "delivered": 2, "read": 3, "failed": 99}


def _allowed_topic(arn: str) -> bool:
    arns = [a.strip() for a in settings.ses_events_sns_topic_arns.split(",") if a.strip()]
    return arn in arns


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


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


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
    topic_arn = payload.get("TopicArn", "")

    if _allowed_topic(topic_arn) is False and settings.ses_events_sns_topic_arns:
        logger.warning("SES events webhook: rejected message from unknown topic %s", topic_arn)
        return "ok"

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

    notification_type: str = event.get("notificationType", "")
    new_status = _STATUS_MAP.get(notification_type)
    if not new_status:
        return "ok"

    mail = event.get("mail") or {}
    headers: list[dict] = mail.get("headers") or []
    email_message_id = _extract_email_message_id(headers)

    if not email_message_id:
        logger.debug("SES events webhook: no Message-ID header in %s event", notification_type)
        return "ok"

    try:
        result = await db.execute(
            select(Message.id, Message.status).where(
                Message.email_message_id == email_message_id
            )
        )
        row = result.first()
        if row is None:
            logger.debug(
                "SES events webhook: no message found for Message-ID %s", email_message_id
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
    except Exception:
        logger.exception(
            "SES events webhook: failed to update message for Message-ID %s", email_message_id
        )

    return "ok"
