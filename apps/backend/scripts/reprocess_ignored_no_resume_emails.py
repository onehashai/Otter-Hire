"""Safely retry retained inbound applications that were ignored for missing resumes.

Run without ``--apply`` first. Applying only requeues records with a retained,
non-automated, non-blocked sender. Raw email and attachments are reused when
available; missing documents leave the candidate resume-pending. Existing
inbound rows and their original received timestamps stay intact.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import binascii
import logging
from uuid import UUID

from sqlalchemy import or_, select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.email import InboundEmail
from app.schemas.public_jobs import InboundEmailPayload
from app.services.storage import storage_service
from app.temporal.inbound_email.queue import enqueue_inbound_email_parse
from app.temporal.inbound_email.types import InboundEmailParseInput

_RECOVERABLE_REASONS = frozenset(
    {
        "No resume attachment or link found - candidate creation requires resume",
        "Email does not match job application keywords",
        "No resume attachment found in parsed email",
        "No resumes successfully parsed",
    }
)
_AUTO_SUPPRESS_REASON_PREFIX = "Automated email skipped: X-Auto-Response-Suppress:"
logger = logging.getLogger("reprocess_ignored_no_resume_emails")


def _is_recoverable_reason(reason: str | None) -> bool:
    return bool(
        reason in _RECOVERABLE_REASONS
        or (reason or "").startswith(_AUTO_SUPPRESS_REASON_PREFIX)
    )


def _payload_from_raw(
    row: InboundEmail, raw_email: bytes
) -> tuple[InboundEmailPayload, bool, bool]:
    from app.api.v1.internal.endpoints.public import (
        _is_automated_email,
        _is_job_board_notification_sender,
        _is_resume_attachment,
    )
    from app.integrations.app_store.email_integration.ses_bridge import (
        _extract_text_and_attachments,
    )

    normalized = _extract_text_and_attachments(raw_email)
    payload = InboundEmailPayload(
        inbox_address=row.inbox_address,
        from_email=row.from_email,
        from_name=row.from_name,
        subject=row.subject,
        message_id=row.message_id,
        received_at=row.received_at.isoformat() if row.received_at else None,
        raw_storage_key=row.raw_storage_key,
        text_body=normalized.get("text_body"),
        html_body=normalized.get("html_body"),
        auto_submitted=normalized.get("auto_submitted"),
        list_unsubscribe=bool(normalized.get("list_unsubscribe")),
        precedence=normalized.get("precedence"),
        x_auto_response_suppress=normalized.get("x_auto_response_suppress"),
    )
    if _is_job_board_notification_sender(row.from_email) or _is_automated_email(payload):
        return payload, False, False

    has_resume = False
    for attachment in normalized.get("attachments") or []:
        try:
            content = base64.b64decode(attachment.get("content_base64") or "", validate=True)
        except (ValueError, TypeError, binascii.Error):
            content = b""
        if _is_resume_attachment(
            attachment.get("filename"),
            attachment.get("content_type"),
            content,
        ):
            has_resume = True
            break

    return payload, has_resume, True


def _is_recoverable_application(
    row: InboundEmail,
    payload: InboundEmailPayload,
    has_resume: bool,
    sender_is_candidate: bool,
    matched_job: bool = False,
) -> bool:
    # The same policy applies to historical mail as to the live ATS inbox:
    # human senders need not use keywords or supply a readable resume.
    return sender_is_candidate and bool((payload.from_email or "").strip())


async def _read_raw_email(row: InboundEmail) -> bytes:
    if settings.s3_enabled:
        bucket = (settings.ses_raw_bridge_bucket or "").strip()
        bucket = bucket or (settings.aws_s3_bucket or "").strip()
        if not bucket:
            raise RuntimeError("No SES raw email bucket is configured")
        response = await asyncio.to_thread(
            lambda: storage_service.s3_client.get_object(
                Bucket=bucket,
                Key=row.raw_storage_key,
            )
        )
        return await asyncio.to_thread(response["Body"].read)
    return await storage_service.read_bytes(row.raw_storage_key)


async def _recovery_payload(
    row: InboundEmail,
) -> tuple[InboundEmailPayload, bool, bool]:
    from app.api.v1.internal.endpoints.public import (
        _is_automated_email,
        _is_job_board_notification_sender,
        _is_resume_attachment,
    )

    if row.raw_storage_key:
        try:
            return _payload_from_raw(row, await _read_raw_email(row))
        except Exception:
            logger.warning("Raw email unavailable; using retained attachment/sender metadata id=%s", row.id)

    content = b""
    if row.attachment_primary_storage_key:
        try:
            content = await storage_service.read_bytes(row.attachment_primary_storage_key)
        except Exception:
            logger.warning("Attachment unavailable; using retained sender metadata id=%s", row.id)
    payload = InboundEmailPayload(
        inbox_address=row.inbox_address,
        from_email=row.from_email,
        from_name=row.from_name,
        subject=row.subject,
    )
    has_resume = bool(content) and _is_resume_attachment(
        row.attachment_primary_filename or "attachment.bin",
        row.attachment_primary_content_type or "application/octet-stream",
        content,
    )
    sender_is_candidate = not (
        _is_job_board_notification_sender(row.from_email) or _is_automated_email(payload)
    )
    return payload, has_resume, sender_is_candidate


async def _mark_processing_and_enqueue(
    row_id: UUID, org_id: UUID, job_id: UUID | None
) -> bool:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InboundEmail)
            .where(InboundEmail.id == row_id)
            .with_for_update(skip_locked=True)
        )
        row = result.scalar_one_or_none()
        if (
            row is None
            or row.parse_status != "ignored"
            or not _is_recoverable_reason(row.parse_error)
            or row.parsed_candidate_id is not None
        ):
            return False
        row.parse_status = "processing"
        row.parse_error = None
        await db.commit()

    try:
        await enqueue_inbound_email_parse(
            inbound_email_id=str(row_id),
            input_data=InboundEmailParseInput(
                inbound_email_id=str(row_id),
                org_id=str(org_id),
                target_job_id=str(job_id) if job_id else None,
                force_contact_only=True,
            ),
            force=True,
        )
    except Exception as exc:
        logger.exception("Could not enqueue inbound email id=%s", row_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(InboundEmail).where(InboundEmail.id == row_id))
            row = result.scalar_one_or_none()
            if row is not None and row.parse_status == "processing":
                row.parse_status = "failed"
                row.parse_error = f"Could not queue historical email recovery: {exc}"[:1000]
                await db.commit()
        return False
    return True


async def reprocess(limit: int, apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InboundEmail)
            .where(
                InboundEmail.parse_status == "ignored",
                or_(
                    InboundEmail.parse_error.in_(_RECOVERABLE_REASONS),
                    InboundEmail.parse_error.like(f"{_AUTO_SUPPRESS_REASON_PREFIX}%"),
                ),
                InboundEmail.from_email.is_not(None),
                InboundEmail.parsed_candidate_id.is_(None),
            )
            .order_by(InboundEmail.received_at.asc())
            .limit(limit)
        )
        rows = result.scalars().all()

    eligible = 0
    unavailable = 0
    skipped = 0
    queued = 0
    for row in rows:
        try:
            payload, has_resume, sender_is_candidate = await _recovery_payload(row)
        except Exception:
            unavailable += 1
            logger.exception("Candidate contact unavailable; leaving inbound row unchanged id=%s", row.id)
            continue

        from app.api.v1.internal.endpoints.public import _resolve_exact_subject_job
        from app.services.blocked_domains import get_blocked_sender_domain

        async with AsyncSessionLocal() as db:
            blocked_domain = await get_blocked_sender_domain(
                db, org_id=row.org_id, sender_email=row.from_email
            )
            matched_job = (
                await _resolve_exact_subject_job(
                    db, org_id=row.org_id, subject=row.subject
                )
                if not row.job_id
                else None
            )
        if blocked_domain or not _is_recoverable_application(
            row, payload, has_resume, sender_is_candidate, matched_job=matched_job is not None
        ):
            skipped += 1
            continue

        eligible += 1
        logger.info(
            "%s recovery candidate id=%s received_at=%s sender_domain=%s",
            "Would queue" if not apply else "Queueing",
            row.id,
            row.received_at,
            (row.from_email or "").rsplit("@", 1)[-1].lower(),
        )
        if apply and await _mark_processing_and_enqueue(
            row.id, row.org_id, row.job_id or (matched_job.id if matched_job else None)
        ):
            queued += 1

    print(
        f"scanned={len(rows)} eligible={eligible} queued={queued} "
        f"skipped_non_application={skipped} unrecoverable={unavailable} apply={apply}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually requeue eligible records; otherwise only report a dry run.",
    )
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 5000:
        parser.error("--limit must be between 1 and 5000")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(reprocess(args.limit, args.apply))


if __name__ == "__main__":
    main()
