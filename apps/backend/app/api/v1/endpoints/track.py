"""
Email open-tracking endpoint.

GET /public/track/open/{message_id}/{token}

Returns a 1x1 transparent GIF and marks the message as 'read' if the HMAC
token is valid. No auth is required — this URL is embedded in outbound HTML
emails and fetched by the recipient's mail client when they open the message.
"""

from __future__ import annotations

import hashlib
import hmac

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db
from app.models.message import Message

router = APIRouter()

# Minimal 1×1 transparent GIF
_TRANSPARENT_GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00"
    b"\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00"
    b"\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


def make_tracking_token(message_id: str, secret: str) -> str:
    """Return a 32-char hex HMAC-SHA256 token for the given message ID."""
    return hmac.new(secret.encode(), message_id.encode(), hashlib.sha256).hexdigest()[:32]


def verify_tracking_token(message_id: str, token: str, secret: str) -> bool:
    expected = make_tracking_token(message_id, secret)
    return hmac.compare_digest(expected, token)


@router.get("/track/open/{message_id}/{token}")
async def track_open(
    message_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Tracking pixel — always returns a 1×1 GIF regardless of token validity."""
    secret = settings.email_tracking_secret
    if secret and verify_tracking_token(message_id, token, secret):
        try:
            await db.execute(
                sa_update(Message)
                .where(
                    Message.id == message_id,  # type: ignore[arg-type]
                    Message.status.in_(["queued", "sent", "delivered"]),
                )
                .values(status="read")
            )
            await db.commit()
        except Exception:
            logger.exception("Failed to mark message %s as read via tracking pixel", message_id)

    return Response(
        content=_TRANSPARENT_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )
