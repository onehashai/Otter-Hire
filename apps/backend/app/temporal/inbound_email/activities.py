from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
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
        _is_resume_attachment,
        _mark_assignment_score_pending,
        _normalize_phone,
        _parse_resume_bytes,
        _resume_confidence_score,
        _route_inbound_to_conversation,
        _upsert_candidate_job_assignment,
        should_replace_name,
    )
    from app.integrations.app_store.email_integration.ses_bridge import _extract_text_and_attachments
    from app.schemas.public_jobs import InboundEmailPayload
    from app.services.resume.pipeline import run_resume_pipeline
    from app.services.storage import storage_service

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

            # 2. Fetch raw email from S3
            if not inbound_email.raw_storage_key:
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = "InboundEmail raw_storage_key is missing"
                await session.commit()
                return {"status": "ignored", "reason": "missing_raw_storage_key"}

            try:
                if settings.s3_enabled:
                    raw_bucket = (settings.ses_raw_bridge_bucket or "").strip()
                    bucket = raw_bucket or (settings.aws_s3_bucket or "").strip()
                    raw_email = await asyncio.to_thread(
                        lambda: storage_service.s3_client.get_object(
                            Bucket=bucket,
                            Key=inbound_email.raw_storage_key
                        )["Body"].read()
                    )
                else:
                    raw_email = await storage_service.read_bytes(inbound_email.raw_storage_key)
            except Exception as e:
                logger.exception("Failed to read raw email key=%s", inbound_email.raw_storage_key)
                return {"status": "failed", "reason": "s3_read_failed"}

            # 3. Parse raw email
            normalized = _extract_text_and_attachments(raw_email)
            attachments = normalized.get("attachments") or []

            # Find the resume attachment
            resume_attachment = None
            for att in attachments:
                if _is_resume_attachment(att.get("filename"), att.get("content_type")):
                    resume_attachment = att
                    break

            if not resume_attachment:
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = "No resume attachment found in parsed email"
                await session.commit()
                return {"status": "ignored", "reason": "no_resume_attachment"}

            # Decode base64 content
            try:
                content = base64.b64decode(resume_attachment.get("content_base64") or "")
            except Exception:
                inbound_email.parse_status = "failed"
                inbound_email.parse_error = "Failed to decode attachment content"
                await session.commit()
                return {"status": "failed", "reason": "base64_decode_failed"}

            resume_filename = resume_attachment.get("filename") or "resume.pdf"
            resume_content_type = resume_attachment.get("content_type") or "application/pdf"

            # 4. Parse resume bytes using existing parser
            try:
                resume_text = _parse_resume_bytes(
                    resume_filename,
                    resume_content_type,
                    content,
                )
            except Exception as exc:
                inbound_email.parse_status = "failed"
                inbound_email.parse_error = f"Resume parse failed: {exc}"
                await session.commit()
                return {"status": "failed", "reason": f"resume_parse_failed: {exc}"}

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
            if confidence < min_confidence:
                inbound_email.parse_status = "ignored"
                inbound_email.parse_error = f"Low resume confidence ({confidence}<{min_confidence})"
                await session.commit()
                return {"status": "ignored", "reason": f"low_confidence: {confidence}"}

            # LLM structured extraction pipeline
            inbound_parsed_resume_profile = None
            _inbound_profile_links = {}
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
                    if should_replace_name(
                        extracted_name,
                        llm_name,
                        fallback_email=extracted_email,
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
            if target_job_id is not None and extracted_email and extracted_name:
                candidate_query = await session.execute(
                    select(Candidate).where(
                        Candidate.org_id == org_id,
                        func.lower(Candidate.email) == extracted_email.lower(),
                        func.lower(func.trim(Candidate.name)) == extracted_name.strip().lower(),
                    )
                )
            elif extracted_email:
                candidate_query = await session.execute(
                    select(Candidate).where(
                        Candidate.org_id == org_id,
                        func.lower(Candidate.email) == extracted_email.lower(),
                    )
                )
            elif extracted_phone:
                normalized_phone = _normalize_phone(extracted_phone)
                if normalized_phone:
                    candidate_query = await session.execute(
                        select(Candidate).where(
                            Candidate.org_id == org_id,
                            Candidate.phone.is_not(None),
                            func.regexp_replace(Candidate.phone, r"\D", "", "g") == normalized_phone,
                        )
                    )
            candidate = candidate_query.scalars().first() if candidate_query is not None else None

            candidate_created = False
            if candidate is None:
                candidate = Candidate(
                    org_id=org_id,
                    job_id=target_job_id,
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
                    tags=[],
                )
                session.add(candidate)
                await session.flush()
                candidate_created = True
            else:
                # Duplicate candidate: create duplicate profile for review
                existing_candidate = candidate
                candidate = Candidate(
                    org_id=org_id,
                    job_id=target_job_id,
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
                    tags=[],
                    is_pending_duplicate_review=True,
                    possible_duplicate_of_id=existing_candidate.id,
                )
                session.add(candidate)
                await session.flush()
                candidate_created = True

            # 6. Associate candidate document
            latest_version_result = await session.execute(
                select(func.max(CandidateDocument.version)).where(
                    CandidateDocument.org_id == org_id,
                    CandidateDocument.candidate_id == candidate.id,
                    CandidateDocument.field_key == "resume",
                )
            )
            latest_version = latest_version_result.scalar_one_or_none() or 0
            current_resume_key = inbound_email.attachment_primary_storage_key or f"orgs/{org_id}/inbox/attachments/{inbound_email.id}/1_{resume_filename}"
            resume_url = await storage_service.resolve_url(current_resume_key)
            session.add(
                CandidateDocument(
                    org_id=org_id,
                    candidate_id=candidate.id,
                    job_id=target_job_id,
                    field_key="resume",
                    field_label_snapshot="Resume",
                    doc_type="resume",
                    name=resume_filename,
                    url=resume_url,
                    object_key=current_resume_key,
                    mime_type=resume_content_type,
                    size_bytes=len(content),
                    uploaded_by_user_id=None,
                    version=int(latest_version) + 1,
                )
            )

            # 5.1 Route candidate through AI Job Matcher if target_job_id is None
            if target_job_id is None:
                from app.services.job_matcher import match_candidate_to_active_job
                matched_job = await match_candidate_to_active_job(
                    org_id=org_id,
                    resume_text=resume_text,
                    email_subject=inbound_email.subject or "",
                    db=session,
                )
                if matched_job:
                    target_job_id = matched_job.id
                    # Also link candidate fields to the matched job if created as unassigned
                    if candidate.job_id is None:
                        candidate.job_id = target_job_id

            if target_job_id is not None:
                first_stage_result = await session.execute(
                    select(Stage)
                    .where(Stage.org_id == org_id, Stage.job_id == target_job_id)
                    .order_by(Stage.position.asc())
                    .limit(1)
                )
                first_stage = first_stage_result.scalar_one_or_none()
                inbound_assignment_at = datetime.now(timezone.utc)
                await _upsert_candidate_job_assignment(
                    session,
                    org_id=org_id,
                    candidate_id=candidate.id,
                    job_id=target_job_id,
                    stage_id=first_stage.id if first_stage else None,
                    assignment_status="active",
                    source=candidate.source,
                    applied_at=inbound_assignment_at,
                    assigned_at=inbound_assignment_at,
                )

            # 7. Route conversation
            # We need a mock payload for the conversation router
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
                conversation_job_id=target_job_id,
            )

            # 8. Trigger score matching
            if target_job_id is not None:
                pending_assignment = await _mark_assignment_score_pending(
                    session,
                    org_id=org_id,
                    candidate_id=candidate.id,
                    job_id=target_job_id,
                )
                await session.flush()
                await _enqueue_assignment_score(
                    org_id=org_id,
                    candidate_id=candidate.id,
                    job_id=target_job_id,
                    generation=int(pending_assignment.resume_score_generation or 0)
                    if pending_assignment is not None
                    else 0,
                )
            else:
                # Trigger generic email received automation
                try:
                    from app.services.automation.execution import execute_automations_for_trigger
                    await execute_automations_for_trigger(
                        db=session,
                        trigger_key="candidate_email_received",
                        org_id=org_id,
                        candidate_id=candidate.id,
                        job_id=None,
                        metadata={
                            "source": "email_inbound",
                            "stage_name": None,
                        },
                    )
                except Exception as e:
                    logger.error(f"Failed to trigger automation for email candidate {candidate.id}: {e}")

            # Update InboundEmail status
            inbound_email.parsed_candidate_id = candidate.id
            inbound_email.parse_status = "processed"
            inbound_email.parse_error = None
            await session.commit()

            return {
                "status": "ok",
                "candidate_id": str(candidate.id),
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
