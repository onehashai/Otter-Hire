from __future__ import annotations

import asyncio
import base64
import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from temporalio import activity

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.models.email import InboundEmail
from app.models.stage import Stage
from app.temporal.inbound_email.types import InboundEmailParseInput

logger = logging.getLogger(__name__)

_RESUME_EVIDENCE_KEYWORDS = frozenset(
    {
        "experience",
        "education",
        "skills",
        "projects",
        "summary",
        "employment",
        "work history",
        "certification",
        "linkedin",
        "github",
    }
)
_IMAGE_ATTACHMENT_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".webp"})
_IMAGE_ATTACHMENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


def _has_stored_resume_fallback(inbound_email: InboundEmail) -> bool:
    """Return whether a receiver-stored resume can recover a missing raw email."""
    return bool(
        inbound_email.has_resume_attachment
        and (inbound_email.attachment_primary_storage_key or "").strip()
    )


def _has_stored_attachment_fallback(inbound_email: InboundEmail) -> bool:
    """Return whether a receiver-stored application attachment can recover raw email."""
    return bool((inbound_email.attachment_primary_storage_key or "").strip())


def _has_supported_resume_signature(content: bytes) -> bool:
    """Require a real PDF, DOCX, or legacy DOC for sender-only recovery."""
    return content.startswith((b"%PDF", b"PK\x03\x04", b"\xd0\xcf\x11\xe0"))


def _is_image_attachment(filename: str | None, content_type: str | None) -> bool:
    """Recognize a source image without treating mail logos as resumes."""
    suffix = (filename or "").lower().rsplit(".", 1)
    extension = f".{suffix[-1]}" if len(suffix) == 2 else ""
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    return extension in _IMAGE_ATTACHMENT_SUFFIXES or mime in _IMAGE_ATTACHMENT_TYPES


def _resume_keyword_points(resume_text: str) -> int:
    """Return capped resume-evidence points from extracted document text."""
    normalized = re.sub(r"\s+", " ", resume_text or "").lower()
    return min(sum(keyword in normalized for keyword in _RESUME_EVIDENCE_KEYWORDS), 3)


def _should_preserve_low_confidence_resume(
    *,
    content: bytes,
    is_candidate_application: bool,
    resume_text: str,
) -> bool:
    """Keep valid application documents for AI parsing despite weak regex extraction."""
    return _has_supported_resume_signature(content) and (
        is_candidate_application or _resume_keyword_points(resume_text) >= 3
    )


def _fallback_sender_name(inbound_email: InboundEmail) -> str:
    name = (inbound_email.from_name or "").strip()
    if name:
        return name
    local_part = (inbound_email.from_email or "").split("@", 1)[0]
    cleaned = re.sub(r"[._+-]+", " ", local_part).strip()
    return cleaned.title() if cleaned else "Unknown Candidate"


def _is_placeholder_candidate_name(name: str | None) -> bool:
    """Identify names created only because the document text was unusable."""
    normalized = re.sub(r"\s+", " ", name or "").strip().lower()
    return normalized in {"unknown", "unknown candidate", "candidate", "applicant"}


def _is_resume_attachment_compatible(
    detector: object,
    filename: str | None,
    content_type: str | None,
    content: bytes | None,
) -> bool:
    """Use content signatures when paired with an older attachment helper."""
    if not callable(detector):
        return isinstance(content, bytes) and _has_supported_resume_signature(content)
    try:
        return bool(detector(filename, content_type, content))
    except TypeError as exc:
        if "positional" not in str(exc):
            raise
        return bool(detector(filename, content_type)) or (
            isinstance(content, bytes) and _has_supported_resume_signature(content)
        )


@activity.defn(name="parse_inbound_email_activity")
async def parse_inbound_email_activity(input_data: InboundEmailParseInput) -> dict:
    """Download raw email, extract resume, parse using run_resume_pipeline, resolve candidate, trigger score matching, and route conversations."""
    from sqlalchemy import func, select

    from app.api.v1.internal.endpoints.public import (
        _enqueue_assignment_score,
        _extract_email,
        _extract_location,
        _extract_name,
        _extract_phone,
        _has_candidate_application_signal,
        _is_job_board_notification_sender,
        _is_resume_attachment,
        _mark_assignment_score_pending,
        _normalize_phone,
        _parse_resume_bytes,
        _resume_confidence_score,
        _route_inbound_to_conversation,
        _upsert_candidate_job_assignment,
        should_replace_name,
    )
    from app.integrations.app_store.email_integration.ses_bridge import (
        _extract_text_and_attachments,
    )
    from app.schemas.public_jobs import InboundEmailPayload
    from app.services.resume.pipeline import run_resume_pipeline
    from app.services.storage import storage_service

    # Spam Control is intentionally staged separately. Do not make inbound
    # parsing unavailable on installations where that optional module is absent.
    try:
        from app.services.blocked_domains import get_blocked_sender_domain
    except ModuleNotFoundError as exc:
        if exc.name != "app.services.blocked_domains":
            raise
        get_blocked_sender_domain = None

    inbound_email_id = UUID(input_data.inbound_email_id)
    org_id = UUID(input_data.org_id)
    target_job_id = UUID(input_data.target_job_id) if input_data.target_job_id else None

    try:
        async with AsyncSessionLocal() as session:
            # 1. Load InboundEmail
            inbound_email_result = await session.execute(
                select(InboundEmail).where(InboundEmail.id == inbound_email_id)
            )
            inbound_email = inbound_email_result.scalar_one_or_none()
            if not inbound_email:
                return {"status": "failed", "reason": "inbound_email_not_found"}

            if inbound_email.parse_status == "processed":
                return {"status": "ok", "reason": "already_processed"}

            # The public receiver commits this state before starting Temporal;
            # set it again here for retries and manual reprocessing requests.
            inbound_email.parse_status = "processing"
            inbound_email.parse_error = None
            await session.commit()

            # A domain may have been blocked after the inbound record was
            # accepted but before its Temporal workflow executes.
            blocked_sender_domain = None
            if get_blocked_sender_domain is not None:
                blocked_sender_domain = await get_blocked_sender_domain(
                    session,
                    org_id=org_id,
                    sender_email=inbound_email.from_email,
                )
            if blocked_sender_domain:
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = (
                    f"Sender domain {blocked_sender_domain} is in organization blocked list"
                )
                await session.commit()
                return {"status": "ignored", "reason": "blocked_sender_domain"}

            # 2. Fetch raw email when available. The receiver separately stores
            # resume attachments, so an expired raw MIME object must not discard
            # an otherwise recoverable application.
            raw_email: bytes | None = None
            if inbound_email.raw_storage_key:
                try:
                    if settings.s3_enabled:
                        raw_bucket = (settings.ses_raw_bridge_bucket or "").strip()
                        bucket = raw_bucket or (settings.aws_s3_bucket or "").strip()
                        raw_email = await asyncio.to_thread(
                            lambda: storage_service.s3_client.get_object(
                                Bucket=bucket,
                                Key=inbound_email.raw_storage_key,
                            )["Body"].read()
                        )
                    else:
                        raw_email = await storage_service.read_bytes(inbound_email.raw_storage_key)
                except Exception:
                    if not _has_stored_attachment_fallback(inbound_email):
                        logger.exception(
                            "Failed to read raw email key=%s", inbound_email.raw_storage_key
                        )
                        return {"status": "failed", "reason": "s3_read_failed"}
                    logger.warning(
                        "Raw email unavailable; using stored resume fallback key=%s",
                        inbound_email.raw_storage_key,
                        exc_info=True,
                    )
            elif not _has_stored_attachment_fallback(inbound_email):
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = "InboundEmail raw_storage_key is missing"
                await session.commit()
                return {"status": "ignored", "reason": "missing_raw_storage_key"}

            # 3. Parse raw email when present. The stored-resume fallback below
            # supplies the attachment for recovery records with no raw MIME data.
            normalized = (
                _extract_text_and_attachments(raw_email)
                if raw_email is not None
                else {"text_body": None, "html_body": None, "attachments": []}
            )
            attachments = normalized.get("attachments") or []
            application_payload = InboundEmailPayload(
                inbox_address=inbound_email.inbox_address,
                from_email=inbound_email.from_email,
                from_name=inbound_email.from_name,
                subject=inbound_email.subject,
                message_id=inbound_email.message_id,
                received_at=inbound_email.received_at.isoformat(),
                raw_storage_key=inbound_email.raw_storage_key,
                text_body=normalized.get("text_body"),
                html_body=normalized.get("html_body"),
                attachments=[],
            )
            sender_is_job_board = _is_job_board_notification_sender(
                inbound_email.from_email
            )
            is_candidate_application = bool(inbound_email.has_resume_attachment) or (
                not sender_is_job_board
                and (
                    _has_candidate_application_signal(
                        application_payload,
                        has_resume=False,
                    )
                    or target_job_id is not None
                    or bool(getattr(input_data, "force_contact_only", False))
                )
            )

            # Gather all resume attachments along with their original indices
            resume_attachments = []
            for original_idx, att in enumerate(attachments):
                try:
                    attachment_content = att.get("content_bytes")
                    if not isinstance(attachment_content, bytes):
                        attachment_content = base64.b64decode(
                            att.get("content_base64") or ""
                        )
                except Exception:
                    attachment_content = None
                if _is_resume_attachment_compatible(
                    _is_resume_attachment,
                    att.get("filename"),
                    att.get("content_type"),
                    attachment_content,
                ):
                    resume_attachments.append((original_idx, att))

            # Receiver-stored attachments include linked, generic, and mislabeled
            # documents. Reuse them when raw MIME parsing did not expose a resume.
            if not resume_attachments and inbound_email.attachment_primary_storage_key:
                try:
                    linked_content = await storage_service.read_bytes(
                        inbound_email.attachment_primary_storage_key
                    )
                except Exception:
                    logger.exception(
                        "Failed to read linked resume key=%s",
                        inbound_email.attachment_primary_storage_key,
                    )
                else:
                    linked_filename = inbound_email.attachment_primary_filename or "resume.pdf"
                    linked_content_type = (
                        inbound_email.attachment_primary_content_type or "application/octet-stream"
                    )
                    if _is_resume_attachment_compatible(
                        _is_resume_attachment,
                        linked_filename,
                        linked_content_type,
                        linked_content,
                    ):
                        resume_attachments.append(
                            (
                                -1,
                                {
                                    "filename": linked_filename,
                                    "content_type": linked_content_type,
                                    "content_bytes": linked_content,
                                    "storage_key": inbound_email.attachment_primary_storage_key,
                                },
                            )
                        )
                    else:
                        if is_candidate_application:
                            resume_attachments.append(
                                (
                                    -1,
                                    {
                                        "filename": linked_filename,
                                        "content_type": linked_content_type,
                                        "content_bytes": linked_content,
                                        "storage_key": inbound_email.attachment_primary_storage_key,
                                        "sender_identity_fallback": True,
                                    },
                                )
                            )

            if not resume_attachments:
                if is_candidate_application and inbound_email.from_email:
                    # Some mail clients strip a declared attachment before the
                    # receiver gets the raw MIME object. Preserve the actual
                    # application as a sender-identified candidate instead of
                    # discarding it solely because no document survived.
                    resume_attachments.append(
                        (
                            -1,
                            {
                                "filename": "",
                                "content_type": "",
                                "content_bytes": b"",
                                "sender_identity_fallback": True,
                                "no_document": True,
                            },
                        )
                    )
                else:
                    inbound_email.parse_status = "ignored"
                    inbound_email.parse_error = "No resume attachment found in parsed email"
                    await session.commit()
                    return {"status": "ignored", "reason": "no_resume_attachment"}

            created_candidate_ids = []

            for original_idx, resume_attachment in resume_attachments:
                # Decode base64 content
                try:
                    linked_content = resume_attachment.get("content_bytes")
                    content = (
                        linked_content
                        if isinstance(linked_content, bytes)
                        else base64.b64decode(resume_attachment.get("content_base64") or "")
                    )
                except Exception:
                    logger.warning("Failed to decode attachment content for %s", resume_attachment.get("filename"))
                    continue

                resume_filename = resume_attachment.get("filename") or f"resume_{original_idx + 1}.pdf"
                resume_content_type = resume_attachment.get("content_type") or "application/pdf"
                no_document = bool(resume_attachment.get("no_document"))
                sender_identity_fallback = bool(
                    resume_attachment.get("sender_identity_fallback")
                )

                # 4. Parse resume bytes using existing parser
                if sender_identity_fallback:
                    resume_text = "\n".join(
                        filter(
                            None,
                            [
                                inbound_email.subject,
                                normalized.get("text_body"),
                                normalized.get("html_body"),
                            ],
                        )
                    )
                    extracted_email = inbound_email.from_email or _extract_email(resume_text)
                    extracted_phone = _extract_phone(resume_text)
                    extracted_name = _fallback_sender_name(inbound_email)
                    extracted_location = _extract_location(resume_text)
                    confidence = 0
                else:
                    try:
                        resume_text = _parse_resume_bytes(
                            resume_filename,
                            resume_content_type,
                            content,
                        )
                    except Exception as exc:
                        logger.warning("Resume parse failed for %s: %s", resume_filename, exc)
                        if not inbound_email.from_email:
                            continue
                        sender_identity_fallback = True
                        resume_text = "\n".join(
                            filter(
                                None,
                                [
                                    inbound_email.subject,
                                    normalized.get("text_body"),
                                    normalized.get("html_body"),
                                ],
                            )
                        )
                        extracted_email = inbound_email.from_email
                        extracted_phone = _extract_phone(resume_text)
                        extracted_name = _fallback_sender_name(inbound_email)
                        extracted_location = _extract_location(resume_text)
                        confidence = 0
                    else:
                        extracted_email = _extract_email(resume_text)
                        extracted_phone = _extract_phone(resume_text)
                        extracted_name = _extract_name(resume_text, extracted_email) or "Unknown Candidate"
                        extracted_location = _extract_location(resume_text)
                        confidence = _resume_confidence_score(
                            resume_text,
                            extracted_name,
                            extracted_email,
                            extracted_phone,
                            extracted_location,
                        )
                min_confidence = max(1, int(settings.inbound_resume_min_confidence))
                if confidence < min_confidence and not sender_identity_fallback:
                    # Scan-only resumes can be valid documents even if OCR has
                    # no usable text. Retain the document and resolve the known
                    # email sender instead of losing the application.
                    if not (
                        inbound_email.from_email
                        and _should_preserve_low_confidence_resume(
                            content=content,
                            is_candidate_application=is_candidate_application,
                            resume_text=resume_text,
                        )
                    ):
                        logger.warning(
                            "Low resume confidence for %s (%s<%s)",
                            resume_filename,
                            confidence,
                            min_confidence,
                        )
                        continue
                    sender_identity_fallback = True
                    extracted_email = inbound_email.from_email
                    extracted_phone = None
                    extracted_location = None
                    extracted_name = _fallback_sender_name(inbound_email)
                    logger.info(
                        "Creating sender-identified candidate for unreadable resume %s",
                        resume_filename,
                    )

                # LLM structured extraction pipeline
                inbound_parsed_resume_profile = None
                _inbound_profile_links = {}
                # Sender identity prevents weak text extraction from blocking
                # candidate creation; it must not suppress the AI resume parse.
                if not no_document:
                    try:
                        _llm_result = await asyncio.to_thread(
                            run_resume_pipeline,
                            resume_filename,
                            resume_content_type,
                            content,
                            fallback_email=inbound_email.from_email or "",
                        )
                        if _llm_result is not None:
                            inbound_parsed_resume_profile = _llm_result.profile.model_dump(mode="json")
                            _personal = _llm_result.profile.personal
                            llm_name = (_personal.full_name or "").strip() or None
                            if llm_name and (
                                sender_identity_fallback
                                or _is_placeholder_candidate_name(extracted_name)
                                or should_replace_name(
                                    extracted_name,
                                    llm_name,
                                    fallback_email=extracted_email,
                                )
                            ):
                                extracted_name = llm_name or extracted_name
                            llm_email = _extract_email((_personal.email or "").strip().lower())
                            if llm_email:
                                extracted_email = llm_email
                            if _personal.phone and _personal.phone.strip():
                                extracted_phone = _personal.phone.strip()
                            if _personal.address and _personal.address.strip():
                                extracted_location = _personal.address.strip()
                            for _key, _url in [
                                ("linkedin", _personal.linkedin_url),
                                ("github", _personal.github_url),
                                ("portfolio", _personal.website_url),
                            ]:
                                if _url and str(_url).strip():
                                    _inbound_profile_links[_key] = str(_url).strip()
                    except Exception as _llm_exc:
                        logger.warning(
                            "inbound LLM resume parse failed (non-fatal) for %s: %s",
                            resume_filename,
                            _llm_exc,
                        )

                if not extracted_email:
                    extracted_email = inbound_email.from_email

                # 5. Resolve candidate
                candidate_query = None
                current_job_id = target_job_id
                candidate = None

                # The sender address is the strongest idempotency key for an
                # inbound resume update. Resume text can contain an older name
                # or a forwarding address, neither of which should duplicate
                # an existing candidate.
                if inbound_email.from_email:
                    candidate_query = await session.execute(
                        select(Candidate)
                        .where(
                            Candidate.org_id == org_id,
                            func.lower(Candidate.email) == inbound_email.from_email.lower(),
                        )
                        .order_by(Candidate.created_at.desc())
                    )
                    candidate = candidate_query.scalars().first()

                if candidate is None and current_job_id is not None and extracted_email and extracted_name:
                    candidate_query = await session.execute(
                        select(Candidate).where(
                            Candidate.org_id == org_id,
                            func.lower(Candidate.email) == extracted_email.lower(),
                            func.lower(func.trim(Candidate.name)) == extracted_name.strip().lower(),
                        )
                    )
                elif candidate is None and extracted_email:
                    candidate_query = await session.execute(
                        select(Candidate).where(
                            Candidate.org_id == org_id,
                            func.lower(Candidate.email) == extracted_email.lower(),
                        )
                    )
                elif candidate is None and extracted_phone:
                    normalized_phone = _normalize_phone(extracted_phone)
                    if normalized_phone:
                        candidate_query = await session.execute(
                            select(Candidate).where(
                                Candidate.org_id == org_id,
                                Candidate.phone.is_not(None),
                                func.regexp_replace(Candidate.phone, r"\D", "", "g") == normalized_phone,
                            )
                        )
                if candidate is None and candidate_query is not None:
                    candidate = candidate_query.scalars().first()

                if candidate is None:
                    candidate = Candidate(
                        org_id=org_id,
                        job_id=current_job_id,
                        stage_id=None,
                        status="active",
                        name=extracted_name,
                        email=extracted_email
                        or f"unknown+{inbound_email.id}@invalid.local",
                        phone=extracted_phone,
                        address=extracted_location,
                        profile_links=_inbound_profile_links if inbound_parsed_resume_profile else {},
                        parsed_resume=inbound_parsed_resume_profile,
                        source="Email",
                        tags=["resume_pending"] if no_document else [],
                    )
                    session.add(candidate)
                    await session.flush()
                else:
                    # A message from an existing candidate with a valid resume
                    # is an update, not a new person. The document below is
                    # versioned against the existing candidate.
                    if candidate.job_id is None and current_job_id is not None:
                        candidate.job_id = current_job_id
                    if _is_placeholder_candidate_name(candidate.name) or should_replace_name(
                        candidate.name,
                        extracted_name,
                        fallback_email=extracted_email,
                    ):
                        candidate.name = extracted_name
                    if not candidate.phone and extracted_phone:
                        candidate.phone = extracted_phone
                    if not candidate.address and extracted_location:
                        candidate.address = extracted_location
                    if no_document and "resume_pending" not in (candidate.tags or []):
                        candidate.tags = [*(candidate.tags or []), "resume_pending"]
                    if inbound_parsed_resume_profile:
                        candidate.parsed_resume = inbound_parsed_resume_profile
                        candidate.profile_links = {
                            **(candidate.profile_links or {}),
                            **_inbound_profile_links,
                        }

                # 6. Associate an available candidate document. A missing raw
                # attachment still produces a candidate and message history.
                if not no_document:
                    is_resume_document = _has_supported_resume_signature(content)
                    document_field_key = (
                        "resume" if is_resume_document else "application_attachment"
                    )
                    latest_version_result = await session.execute(
                        select(func.max(CandidateDocument.version)).where(
                            CandidateDocument.org_id == org_id,
                            CandidateDocument.candidate_id == candidate.id,
                            CandidateDocument.field_key == document_field_key,
                        )
                    )
                    latest_version = latest_version_result.scalar_one_or_none() or 0

                    from app.api.v1.internal.endpoints.public import _guess_file_name

                    safe_name = _guess_file_name(
                        resume_filename,
                        f"attachment_{original_idx + 1}.bin",
                    )
                    current_resume_key = str(
                        resume_attachment.get("storage_key")
                        or f"orgs/{org_id}/inbox/attachments/{inbound_email.id}/{original_idx + 1}_{safe_name}"
                    )

                    resume_url = await storage_service.resolve_url(current_resume_key)
                    session.add(
                        CandidateDocument(
                            org_id=org_id,
                            candidate_id=candidate.id,
                            job_id=current_job_id,
                            field_key=document_field_key,
                            field_label_snapshot=(
                                "Resume" if is_resume_document else "Application attachment"
                            ),
                            doc_type=(
                                "resume" if is_resume_document else "application_attachment"
                            ),
                            name=resume_filename,
                            url=resume_url,
                            object_key=current_resume_key,
                            mime_type=resume_content_type,
                            size_bytes=len(content),
                            uploaded_by_user_id=None,
                            version=int(latest_version) + 1,
                        )
                    )

                    # Persist application photos independently of the resume.
                    # This gives the enrichment workflow the original bytes and
                    # prevents image extraction from depending on raw email
                    # retention. Only images accompanying a real document are
                    # stored, so signatures and newsletter logos are excluded.
                    for image_idx, image_attachment in enumerate(attachments):
                        if image_idx == original_idx or not _is_image_attachment(
                            image_attachment.get("filename"),
                            image_attachment.get("content_type"),
                        ):
                            continue
                        try:
                            image_content = image_attachment.get("content_bytes")
                            if not isinstance(image_content, bytes):
                                image_content = base64.b64decode(
                                    image_attachment.get("content_base64") or ""
                                )
                            if not image_content:
                                continue
                        except Exception:
                            logger.warning(
                                "Failed to decode image attachment for inbound email %s",
                                inbound_email.id,
                            )
                            continue

                        image_field_key = f"email_image_{image_idx + 1}"
                        existing_image = await session.scalar(
                            select(CandidateDocument.id).where(
                                CandidateDocument.org_id == org_id,
                                CandidateDocument.candidate_id == candidate.id,
                                CandidateDocument.field_key == image_field_key,
                            )
                        )
                        if existing_image is not None:
                            continue
                        image_name = _guess_file_name(
                            image_attachment.get("filename") or "application-photo.jpg",
                            f"application-photo-{image_idx + 1}.jpg",
                        )
                        image_key = (
                            f"orgs/{org_id}/inbox/attachments/{inbound_email.id}/"
                            f"image_{image_idx + 1}_{image_name}"
                        )
                        await storage_service.write_bytes(
                            image_key,
                            image_content,
                            image_attachment.get("content_type") or "application/octet-stream",
                        )
                        image_url = await storage_service.resolve_url(image_key)
                        session.add(
                            CandidateDocument(
                                org_id=org_id,
                                candidate_id=candidate.id,
                                job_id=current_job_id,
                                field_key=image_field_key,
                                field_label_snapshot="Application photo",
                                doc_type="application_attachment",
                                name=image_name,
                                url=image_url,
                                object_key=image_key,
                                mime_type=image_attachment.get("content_type")
                                or "application/octet-stream",
                                size_bytes=len(image_content),
                                uploaded_by_user_id=None,
                                version=1,
                            )
                        )

                # 5.1 Route candidate through AI Job Matcher if current_job_id is None
                if current_job_id is None and not no_document:
                    from app.services.job_matcher import match_candidate_to_active_job
                    matched_job = await match_candidate_to_active_job(
                        org_id=org_id,
                        resume_text=resume_text,
                        email_subject=inbound_email.subject or "",
                        db=session,
                    )
                    if matched_job:
                        current_job_id = matched_job.id
                        if candidate.job_id is None:
                            candidate.job_id = current_job_id

                if current_job_id is not None:
                    first_stage_result = await session.execute(
                        select(Stage)
                        .where(Stage.org_id == org_id, Stage.job_id == current_job_id)
                        .order_by(Stage.position.asc())
                        .limit(1)
                    )
                    first_stage = first_stage_result.scalar_one_or_none()
                    inbound_assignment_at = datetime.now(timezone.utc)
                    await _upsert_candidate_job_assignment(
                        session,
                        org_id=org_id,
                        candidate_id=candidate.id,
                        job_id=current_job_id,
                        stage_id=first_stage.id if first_stage else None,
                        assignment_status="active",
                        source=candidate.source,
                        applied_at=inbound_assignment_at,
                        assigned_at=inbound_assignment_at,
                    )

                # 7. Route conversation
                mock_payload = InboundEmailPayload(
                    inbox_address=inbound_email.inbox_address,
                    from_email=inbound_email.from_email,
                    from_name=inbound_email.from_name,
                    subject=inbound_email.subject,
                    message_id=inbound_email.message_id,
                    received_at=inbound_email.received_at.isoformat(),
                    raw_storage_key=inbound_email.raw_storage_key,
                    text_body=normalized.get("text_body"),
                    html_body=normalized.get("html_body"),
                    attachments=[],
                )

                await _route_inbound_to_conversation(
                    session,
                    org_id,
                    inbound_email.inbox_address,
                    mock_payload,
                    reply_to_conversation_id=None,
                    candidate_override=candidate,
                    conversation_job_id=current_job_id,
                )

                # 8. Score actual resumes only. Contact-only candidates wait
                # for an automation to request a resume instead.
                if current_job_id is not None and not no_document:
                    pending_assignment = await _mark_assignment_score_pending(
                        session,
                        org_id=org_id,
                        candidate_id=candidate.id,
                        job_id=current_job_id,
                    )
                    await session.flush()
                    await _enqueue_assignment_score(
                        org_id=org_id,
                        candidate_id=candidate.id,
                        job_id=current_job_id,
                        generation=int(pending_assignment.resume_score_generation or 0)
                        if pending_assignment is not None
                        else 0,
                    )
                try:
                    from app.services.automation import (
                        execute_automations_for_trigger,
                    )
                    await execute_automations_for_trigger(
                        db=session,
                        trigger_key="candidate_email_received",
                        org_id=org_id,
                        candidate_id=candidate.id,
                        job_id=current_job_id,
                        metadata={
                            "source": "email_inbound",
                            "stage_name": None,
                            "resume_pending": no_document,
                            "contact_only": no_document,
                        },
                    )
                except Exception as e:
                    logger.error(f"Failed to trigger automation for email candidate {candidate.id}: {e}")

                created_candidate_ids.append(str(candidate.id))

            if created_candidate_ids:
                inbound_email.parsed_candidate_id = UUID(created_candidate_ids[-1])
                inbound_email.parse_status = "processed"
                inbound_email.parse_error = None
            else:
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = "No resumes successfully parsed"

            await session.commit()

            if created_candidate_ids:
                try:
                    from app.temporal.candidate_enrichment.queue import enqueue_candidate_enrichment
                    from app.temporal.candidate_enrichment.types import CandidateEnrichmentInput

                    for candidate_id in set(created_candidate_ids):
                        await enqueue_candidate_enrichment(
                            input_data=CandidateEnrichmentInput(
                                org_id=str(org_id), candidate_id=candidate_id
                            )
                        )
                except Exception:
                    logger.exception(
                        "Could not queue inbound candidate enrichment inbound_email_id=%s",
                        inbound_email.id,
                    )

            return {
                "status": "ok" if created_candidate_ids else "ignored",
                "candidate_id": created_candidate_ids[-1] if created_candidate_ids else None,
                "inbound_email_id": str(inbound_email.id),
            }

    except Exception as e:
        logger.exception("Error during inbound email resume parsing background activity")
        # Set failed status in database
        try:
            async with AsyncSessionLocal() as fail_session:
                inbound_email_result = await fail_session.execute(
                    select(InboundEmail).where(InboundEmail.id == inbound_email_id)
                )
                inbound_email = inbound_email_result.scalar_one_or_none()
                if inbound_email:
                    inbound_email.parse_status = "failed"
                    inbound_email.parse_error = str(e)
                    await fail_session.commit()
        except Exception:
            logger.exception("Failed to write parse failure to database")
        raise
