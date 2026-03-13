from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import boto3
from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.integration_credential import IntegrationCredential


def _aws_region_for_ses() -> str:
    """Return the AWS region used for SES outbound.

    Falls back to the S3 region which is already required for inbound SES.
    """
    region = (settings.aws_s3_region or "").strip()
    if not region:
        raise RuntimeError("AWS_S3_REGION (or AWS_SES_REGION) must be configured for SES outbound")
    return region


def _ses_client():
    return boto3.client(
        "sesv2",
        region_name=_aws_region_for_ses(),
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def _ensure_message_id_format(msg_id: str) -> str:
    """Ensure Message-ID is in angle brackets for In-Reply-To/References headers."""
    s = (msg_id or "").strip()
    if not s:
        return s
    return s if s.startswith("<") and s.endswith(">") else f"<{s}>"


def send_email_via_ses(
    *,
    from_email: str,
    from_name: str | None,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    reply_to: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
    message_id_tag: str | None = None,
    org_id_tag: str | None = None,
) -> str:
    """Send one email via SES API. Returns the SES MessageId for the sent message."""
    client = _ses_client()
    source = f"{from_name} <{from_email}>" if from_name else from_email
    content: dict[str, Any] = {
        "Simple": {
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": text_body, "Charset": "UTF-8"}},
        }
    }
    if html_body:
        content["Simple"]["Body"]["Html"] = {"Data": html_body, "Charset": "UTF-8"}

    # Threading: In-Reply-To and References so Gmail (and others) keep the reply in the same thread
    if in_reply_to or references:
        content["Simple"]["Headers"] = []
        if in_reply_to:
            content["Simple"]["Headers"].append(
                {"Name": "In-Reply-To", "Value": _ensure_message_id_format(in_reply_to)}
            )
        if references:
            # References is space-separated list of message-ids; normalize each to angle-bracket form
            refs = " ".join(
                _ensure_message_id_format(r.strip()) for r in references.split() if r.strip()
            )
            if refs:
                content["Simple"]["Headers"].append({"Name": "References", "Value": refs})

    params: dict[str, Any] = {
        "FromEmailAddress": source,
        "Destination": {"ToAddresses": [to_email]},
        "Content": content,
    }
    if reply_to:
        params["ReplyToAddresses"] = [reply_to]

    tags: list[dict[str, str]] = []
    if message_id_tag:
        tags.append({"Name": "message_id", "Value": message_id_tag})
    if org_id_tag:
        tags.append({"Name": "org_id", "Value": org_id_tag})
    if tags:
        params["EmailTags"] = tags

    if settings.ses_configuration_set:
        params["ConfigurationSetName"] = settings.ses_configuration_set

    resp = client.send_email(**params)
    message_id = resp.get("MessageId") or ""
    logger.info(
        "SES send_email: MessageId=%s to=%s tags=%s",
        message_id,
        to_email,
        [t["Name"] for t in tags],
    )
    return message_id


async def record_ses_event(
    db: AsyncSession,
    org_id: UUID,
    notification_type: str,
) -> None:
    """Update basic per-org SES reputation counters and pause sending on abuse.

    This is intentionally simple: counters accumulate indefinitely and are used
    only to detect obviously unhealthy sending patterns (high bounce/complaint
    rates). When thresholds are exceeded, the org's SMTP integration is marked
    as 'failed' so outbound sending is paused until reviewed.
    """
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_type == "outbound_email",
        )
    )
    row: IntegrationCredential | None = result.scalar_one_or_none()
    if row is None:
        return

    cfg = dict(row.config or {})
    reputation = dict(cfg.get("ses_reputation") or {})

    total_delivered = int(reputation.get("total_delivered") or 0)
    total_bounced = int(reputation.get("total_bounced") or 0)
    total_complaints = int(reputation.get("total_complaints") or 0)

    nt = notification_type.lower()
    if nt == "delivery":
        total_delivered += 1
    elif nt == "bounce":
        total_bounced += 1
    elif nt == "complaint":
        total_complaints += 1

    reputation.update(
        {
            "total_delivered": total_delivered,
            "total_bounced": total_bounced,
            "total_complaints": total_complaints,
            "last_event_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    # Simple protection thresholds
    sending_paused = bool(reputation.get("sending_paused"))
    if total_delivered >= 100:
        bounce_rate = total_bounced / max(total_delivered, 1)
        complaint_rate = total_complaints / max(total_delivered, 1)
        if bounce_rate > 0.05 or complaint_rate > 0.01:
            sending_paused = True
            logger.warning(
                "SES outbound: pausing sending for org=%s due to high bounce/complaint "
                "rate (delivered=%s, bounces=%s, complaints=%s)",
                org_id,
                total_delivered,
                total_bounced,
                total_complaints,
            )

    reputation["sending_paused"] = sending_paused
    cfg["ses_reputation"] = reputation

    new_status = row.status
    if sending_paused and row.status == "active":
        new_status = "failed"

    await db.execute(
        sa_update(IntegrationCredential)
        .where(IntegrationCredential.id == row.id)
        .values(config=cfg, status=new_status, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()
