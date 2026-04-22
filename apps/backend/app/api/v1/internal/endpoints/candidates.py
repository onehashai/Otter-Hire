from __future__ import annotations

import asyncio
import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.logging import logger
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.activity import Activity
from app.models.automation import AutomationExecution
from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.document import CandidateDocument
from app.models.feedback import Feedback
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.note import Note
from app.models.org_membership import OrgMembership
from app.models.stage import Stage
from app.models.user import User
from app.schemas.candidates import (
    CandidateActivityResponse,
    CandidateApplicationResponseFile,
    CandidateApplicationResponseItem,
    CandidateApplicationResponsesResponse,
    CandidateAssignmentItemResponse,
    CandidateBulkAssignJobRequest,
    CandidateBulkStageUpdateRequest,
    CandidateBulkStatusUpdateRequest,
    CandidateBulkUpdateResponse,
    CandidateCreateRequest,
    CandidateCsvImportError,
    CandidateCsvImportResponse,
    CandidateDetailResponse,
    CandidateDocumentResponse,
    CandidateEvaluationResponse,
    CandidateFeedbackCreateRequest,
    CandidateFeedbackResponse,
    CandidateInterviewCreateRequest,
    CandidateInterviewResponse,
    CandidateListItemResponse,
    CandidateListResponse,
    CandidateNoteMentionResponse,
    CandidateNoteRequest,
    CandidateNoteResponse,
    CandidateOverviewResponse,
    CandidateStageFilterOptionsResponse,
    CandidateStageUpdateRequest,
    CandidateStatusUpdateRequest,
    CandidateUpdateRequest,
)
from app.schemas.validators import is_valid_email, is_valid_phone
from app.services.automation import execute_automations_for_trigger
from app.services.email import send_candidate_note_mention_email
from app.services.media import ensure_pdf_type, read_upload_with_size_check
from app.services.resume.pipeline import run_resume_pipeline
from app.services.storage import storage_service
from app.utils.uuid import uuid7

router = APIRouter(prefix="/candidates", tags=["candidates"])


def _parse_optional_iso_datetime_query(value: str | None) -> datetime | None:
    """Parse ISO 8601 datetimes from query strings (including Z from JS Date.toISOString())."""
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid updated_from or updated_to (expected ISO 8601 datetime).",
        ) from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _object_key_from_stored_file_url(url: str) -> str | None:
    """Extract storage object key from URLs produced by storage_service.resolve_url."""
    clean = (url or "").strip()
    for prefix in ("/v1/internal/files/local/", "/api/files/local/", "/files/local/"):
        if clean.startswith(prefix):
            return clean[len(prefix) :].lstrip("/")
    return None


async def _stream_candidate_pdf_inline(
    *, normalized_key: str, filename: str
) -> Response | FileResponse:
    headers = {"Content-Disposition": f'inline; filename="{(filename or "document.pdf").strip()}"'}

    if settings.s3_enabled and storage_service.use_s3 and storage_service.s3_client:
        try:
            s3_response = storage_service.s3_client.get_object(
                Bucket=storage_service.bucket,
                Key=storage_service._s3_key(normalized_key),
            )
        except Exception:
            raise HTTPException(status_code=404, detail="File not found")

        content = s3_response["Body"].read()
        return Response(content=content, media_type="application/pdf", headers=headers)

    root = Path(settings.local_storage_root).resolve()
    full_path = (root / normalized_key).resolve()
    if not str(full_path).startswith(str(root)) or not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path, media_type="application/pdf", headers=headers)


async def _resolve_candidate_document_url(doc: CandidateDocument) -> str:
    clean_url = (doc.url or "").strip()
    if clean_url.startswith(
        ("http://", "https://", "/v1/internal/files/local/", "/api/files/local/", "/files/local/")
    ):
        return clean_url
    if (doc.object_key or "").strip():
        return await storage_service.resolve_url(doc.object_key)
    return clean_url


async def _log_activity(
    db: AsyncSession,
    *,
    org_id,
    candidate_id,
    created_by_user_id,
    activity_type: str,
    metadata: dict | None = None,
) -> None:
    db.add(
        Activity(
            org_id=org_id,
            candidate_id=candidate_id,
            created_by_user_id=created_by_user_id,
            type=activity_type,
            metadata_=metadata or {},
        )
    )


async def _upsert_candidate_job_assignment(
    db: AsyncSession,
    *,
    org_id: UUID,
    candidate_id: UUID,
    job_id: UUID,
    stage_id: UUID | None,
    assignment_status: str = "active",
    source: str | None = None,
    applied_at: datetime | None = None,
    assigned_at: datetime | None = None,
) -> CandidateJobs:
    existing_result = await db.execute(
        select(CandidateJobs).where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.candidate_id == candidate_id,
            CandidateJobs.job_id == job_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is None:
        existing = CandidateJobs(
            assigned_id=uuid7(),
            org_id=org_id,
            candidate_id=candidate_id,
            job_id=job_id,
            stage_id=stage_id,
            assignment_status=assignment_status,
            source=source,
            applied_at=applied_at,
            assigned_at=assigned_at,
        )
        db.add(existing)
    else:
        existing.stage_id = stage_id
        existing.assignment_status = assignment_status
        if source:
            existing.source = source
        if applied_at is not None and existing.applied_at is None:
            existing.applied_at = applied_at
        if assigned_at is not None:
            existing.assigned_at = assigned_at
    await db.flush()
    return existing


async def _load_candidate_assignments(
    db: AsyncSession, *, org_id: UUID, candidate_ids: list[UUID]
) -> dict[UUID, list[CandidateAssignmentItemResponse]]:
    if not candidate_ids:
        return {}
    rows_result = await db.execute(
        select(CandidateJobs, Job.title, Stage.name)
        .outerjoin(Job, Job.id == CandidateJobs.job_id)
        .outerjoin(Stage, Stage.id == CandidateJobs.stage_id)
        .where(
            CandidateJobs.org_id == org_id,
            CandidateJobs.candidate_id.in_(candidate_ids),
        )
        .order_by(CandidateJobs.updated_at.desc(), CandidateJobs.created_at.desc())
    )
    grouped: dict[UUID, list[CandidateAssignmentItemResponse]] = {}
    for assignment, job_title, stage_name in rows_result.all():
        grouped.setdefault(assignment.candidate_id, []).append(
            CandidateAssignmentItemResponse(
                assigned_id=assignment.assigned_id,
                job_id=assignment.job_id,
                job_title=job_title,
                stage_id=assignment.stage_id,
                stage_name=stage_name,
                assignment_status=assignment.assignment_status,
                source=assignment.source,
                applied_at=assignment.applied_at,
                assigned_at=assignment.assigned_at,
                created_at=assignment.created_at,
                updated_at=assignment.updated_at,
            )
        )
    return grouped


def _serialize_note_mentions(raw_mentions: list[dict] | None) -> list[CandidateNoteMentionResponse]:
    if not raw_mentions:
        return []
    mentions: list[CandidateNoteMentionResponse] = []
    for mention in raw_mentions:
        user_id = mention.get("user_id")
        email = (mention.get("email") or "").strip()
        if not user_id or not email:
            continue
        mentions.append(
            CandidateNoteMentionResponse(
                user_id=user_id,
                name=(mention.get("name") or "").strip() or None,
                email=email,
            )
        )
    return mentions


async def _resolve_note_mentions(
    db: AsyncSession,
    *,
    org_id: UUID,
    mention_ids: list[UUID],
) -> list[CandidateNoteMentionResponse]:
    if not mention_ids:
        return []

    ordered_ids = list(dict.fromkeys(mention_ids))
    result = await db.execute(
        select(User, OrgMembership)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .where(
            OrgMembership.org_id == org_id,
            OrgMembership.status == "active",
            User.id.in_(ordered_ids),
        )
    )
    rows = result.all()
    by_id = {
        user.id: CandidateNoteMentionResponse(
            user_id=user.id,
            name=user.name,
            email=user.email,
        )
        for user, _membership in rows
    }

    resolved = [by_id[user_id] for user_id in ordered_ids if user_id in by_id]
    if len(resolved) != len(ordered_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="One or more tagged users are invalid or inactive",
        )
    return resolved


def _candidate_note_url(candidate: Candidate) -> str:
    """App routes: talent pool vs job workspace (there is no top-level /candidates/[id] page)."""
    base = settings.frontend_base_url.rstrip("/")
    cid = candidate.id
    if candidate.job_id is not None:
        return f"{base}/jobs/{candidate.job_id}/candidates/{cid}"
    return f"{base}/talent-pool/{cid}"


def _candidate_note_excerpt(content: str, limit: int = 280) -> str:
    compact = " ".join(content.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 1].rstrip()}…"


def _application_response_value(
    field_type: str, raw_value: object
) -> str | int | float | bool | list[str] | None:
    if raw_value is None:
        return None
    normalized_type = (field_type or "").strip().lower()
    if normalized_type == "multi_select":
        if isinstance(raw_value, list):
            values = [str(item).strip() for item in raw_value if str(item).strip()]
            return values or None
        text = str(raw_value).strip()
        return [text] if text else None
    if normalized_type == "yes_no":
        if isinstance(raw_value, bool):
            return raw_value
        text = str(raw_value).strip().lower()
        if text in {"yes", "true", "1"}:
            return True
        if text in {"no", "false", "0"}:
            return False
        return None
    if normalized_type == "number":
        if isinstance(raw_value, (int, float)):
            return raw_value
        text = str(raw_value).strip()
        if not text:
            return None
        try:
            if "." in text:
                return float(text)
            return int(text)
        except ValueError:
            return text
    text = str(raw_value).strip()
    return text or None


async def _resolve_application_file_link(
    file_ref: object,
) -> CandidateApplicationResponseFile | None:
    if not isinstance(file_ref, str):
        return None
    raw = file_ref.strip()
    if not raw:
        return None

    resolved_url = raw
    if not raw.startswith(
        ("http://", "https://", "/v1/internal/files/local/", "/api/files/local/", "/files/local/")
    ):
        resolved_url = await storage_service.resolve_url(raw)

    name = raw.rsplit("/", 1)[-1] if "/" in raw else raw
    name = name.split("?", 1)[0].strip() or "attachment"
    return CandidateApplicationResponseFile(name=name, url=resolved_url)


def _iter_application_custom_questions(schema_snapshot: dict) -> list[tuple[str, str, str, bool]]:
    custom_fields = schema_snapshot.get("custom_fields") or []
    items: list[tuple[str, str, str, bool]] = []
    for raw_field in custom_fields:
        if not isinstance(raw_field, dict):
            continue
        key = str(raw_field.get("key") or raw_field.get("id") or "").strip()
        if not key:
            continue
        visibility = str(raw_field.get("visibility") or "optional").strip().lower()
        if visibility == "hidden":
            continue
        field_type = str(raw_field.get("type") or "short_text").strip()
        label = str(raw_field.get("label") or key).strip() or key
        items.append((key, label, field_type, visibility == "required"))
    return items


def _canonical_profile_link_key(field_key: str) -> str:
    key = (field_key or "").strip()
    if key.startswith("profile_link_"):
        suffix = key.removeprefix("profile_link_").strip()
        if suffix:
            return suffix
    return key


def _extract_profile_links_from_application(
    schema_snapshot: dict | None, answers: dict | None
) -> dict[str, str]:
    schema = dict(schema_snapshot or {})
    values = dict(answers or {})
    profile_link_fields = schema.get("profile_links") or []
    normalized: dict[str, str] = {}
    for field in profile_link_fields:
        if not isinstance(field, dict):
            continue
        visibility = str(field.get("visibility") or "hidden").strip().lower()
        if visibility == "hidden":
            continue
        field_key = str(field.get("key") or field.get("id") or "").strip()
        if not field_key:
            continue
        raw = values.get(field_key)
        if raw is None:
            continue
        link = str(raw).strip()
        if not link:
            continue
        normalized[_canonical_profile_link_key(field_key)] = link
    return normalized


@router.post("", response_model=CandidateDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_candidate(
    body: CandidateCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    job = None
    if body.job_id is not None:
        job_result = await db.execute(
            select(Job).where(Job.id == body.job_id, Job.org_id == current_user.org_id)
        )
        job = job_result.scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    normalized_email = body.email.strip().lower()
    existing_result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == current_user.org_id,
            Candidate.job_id == body.job_id,
            func.lower(Candidate.email) == normalized_email,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Candidate already exists for this job and email",
        )

    stage_id = body.stage_id
    if stage_id is not None and body.job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stage can only be set when job is selected",
        )

    if stage_id is not None:
        stage_result = await db.execute(
            select(Stage).where(
                Stage.id == stage_id,
                Stage.org_id == current_user.org_id,
                Stage.job_id == body.job_id,
            )
        )
        stage = stage_result.scalar_one_or_none()
        if stage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage for candidate job"
            )
    elif body.job_id is not None:
        first_stage_result = await db.execute(
            select(Stage)
            .where(Stage.org_id == current_user.org_id, Stage.job_id == body.job_id)
            .order_by(Stage.position.asc())
            .limit(1)
        )
        first_stage = first_stage_result.scalar_one_or_none()
        stage_id = first_stage.id if first_stage else None

    candidate = Candidate(
        org_id=current_user.org_id,
        job_id=body.job_id,
        stage_id=stage_id,
        status=body.status,
        name=body.name.strip(),
        email=normalized_email,
        phone=(body.phone or "").strip() or None,
        address=(body.address or "").strip() or None,
        profile_links=dict(body.profile_links or {}),
        source=(body.source or "Manual").strip() or "Manual",
        tags=list(body.tags or []),
    )
    db.add(candidate)
    await db.flush()
    created_assignment: CandidateJobs | None = None
    if candidate.job_id is not None:
        created_assignment = await _upsert_candidate_job_assignment(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            stage_id=candidate.stage_id,
            assignment_status=candidate.status
            if candidate.status in {"active", "rejected", "hired"}
            else "active",
            source=candidate.source,
            applied_at=candidate.created_at if candidate.source == "job_portal" else None,
            assigned_at=candidate.updated_at,
        )
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="candidate_created",
        metadata={
            "job_id": str(candidate.job_id) if candidate.job_id else None,
            "source": candidate.source,
        },
    )
    await db.commit()

    # Fetch stage name for automation metadata
    stage_name = None
    if candidate.stage_id:
        stage_result = await db.execute(select(Stage.name).where(Stage.id == candidate.stage_id))
        stage_name = stage_result.scalar_one_or_none()

    # Trigger automations for candidate_applied ONLY if job is assigned
    # Talent pool candidates (no job) should NOT trigger application emails
    if candidate.job_id is not None:
        await execute_automations_for_trigger(
            db=db,
            trigger_key="candidate_applied",
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            metadata={
                "source": candidate.source,
                "stage_name": stage_name,
                "assigned_id": str(created_assignment.assigned_id) if created_assignment else None,
            },
        )

    return await get_candidate(candidate.id, db, current_user)


@router.post("/import-csv", response_model=CandidateCsvImportResponse)
async def import_candidates_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a CSV file"
        )

    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must be UTF-8 encoded",
        )

    reader = csv.DictReader(content.splitlines())
    required = {"name", "email"}
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV header is missing")
    normalized_headers = {h.strip().lower() for h in reader.fieldnames if h}
    if not required.issubset(normalized_headers):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must include required columns: name,email",
        )

    created_count = 0
    total_rows = 0
    errors: list[CandidateCsvImportError] = []

    for idx, row in enumerate(reader, start=2):
        total_rows += 1
        name = (row.get("name") or row.get("Name") or "").strip()
        email = (row.get("email") or row.get("Email") or "").strip().lower()
        phone = (row.get("phone") or row.get("Phone") or "").strip() or None
        source = (row.get("source") or row.get("Source") or "Manual").strip() or "Manual"

        if not name or not email:
            errors.append(CandidateCsvImportError(row=idx, reason="Missing required name/email"))
            continue
        if not is_valid_email(email):
            errors.append(CandidateCsvImportError(row=idx, reason="Invalid email format"))
            continue
        if phone and not is_valid_phone(phone):
            errors.append(CandidateCsvImportError(row=idx, reason="Invalid phone number format"))
            continue

        existing_result = await db.execute(
            select(Candidate.id).where(
                Candidate.org_id == current_user.org_id,
                Candidate.job_id.is_(None),
                func.lower(Candidate.email) == email,
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            errors.append(
                CandidateCsvImportError(row=idx, reason="Candidate already exists in talent pool")
            )
            continue

        candidate = Candidate(
            org_id=current_user.org_id,
            job_id=None,
            stage_id=None,
            status="active",
            name=name,
            email=email,
            phone=phone,
            address=None,
            profile_links={},
            source=source,
            tags=[],
        )
        db.add(candidate)
        await db.flush()
        await _log_activity(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            created_by_user_id=current_user.id,
            activity_type="candidate_created",
            metadata={"job_id": None, "source": candidate.source},
        )
        created_count += 1

    await db.commit()
    return CandidateCsvImportResponse(
        total_rows=total_rows,
        created_count=created_count,
        failed_count=len(errors),
        errors=errors,
    )


@router.post(
    "/from-resume",
    response_model=CandidateDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_candidate_from_resume(
    file: UploadFile = File(...),
    job_id: str | None = Form(default=None),
    stage_id: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    ensure_pdf_type(file.content_type)
    content = await read_upload_with_size_check(file)
    safe_name = (file.filename or "resume.pdf").strip()

    # Parse resume synchronously in a thread pool to extract contact info
    try:
        result = await asyncio.to_thread(run_resume_pipeline, safe_name, "application/pdf", content)
        personal = result.profile.personal
        parsed_name = (personal.full_name or "").strip() or None
        parsed_email = (personal.email or "").strip().lower() or None
        parsed_phone = (personal.phone or "").strip() or None
        parsed_address = (personal.address or "").strip() or None
    except Exception:
        parsed_name = None
        parsed_email = None
        parsed_phone = None
        parsed_address = None

    # Fallback: derive name from filename stem
    if not parsed_name:
        stem = Path(safe_name).stem.replace("_", " ").replace("-", " ").strip()
        parsed_name = stem.title() if stem else "Unknown Candidate"

    # Fallback: generate placeholder email if not found in resume
    if not parsed_email:
        parsed_email = f"resume-{uuid7()}@noreply.placeholder"

    # Resolve optional job/stage UUIDs
    parsed_job_id: UUID | None = None
    parsed_stage_id: UUID | None = None
    job = None
    if job_id:
        try:
            parsed_job_id = UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job_id")
        job_result = await db.execute(
            select(Job).where(Job.id == parsed_job_id, Job.org_id == current_user.org_id)
        )
        job = job_result.scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if stage_id:
        try:
            parsed_stage_id = UUID(stage_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage_id")

    # Resolve stage: use provided stage or auto-assign first stage for job
    resolved_stage_id: UUID | None = None
    if parsed_stage_id is not None and parsed_job_id is not None:
        stage_result = await db.execute(
            select(Stage).where(
                Stage.id == parsed_stage_id,
                Stage.org_id == current_user.org_id,
                Stage.job_id == parsed_job_id,
            )
        )
        if stage_result.scalar_one_or_none() is not None:
            resolved_stage_id = parsed_stage_id
    elif parsed_job_id is not None:
        first_stage_result = await db.execute(
            select(Stage)
            .where(Stage.org_id == current_user.org_id, Stage.job_id == parsed_job_id)
            .order_by(Stage.position.asc())
            .limit(1)
        )
        first_stage = first_stage_result.scalar_one_or_none()
        resolved_stage_id = first_stage.id if first_stage else None

    candidate = Candidate(
        org_id=current_user.org_id,
        job_id=parsed_job_id,
        stage_id=resolved_stage_id,
        status="active",
        name=parsed_name,
        email=parsed_email,
        phone=parsed_phone,
        address=parsed_address,
        profile_links={},
        source="Manual",
        tags=[],
    )
    db.add(candidate)
    await db.flush()

    created_assignment: CandidateJobs | None = None
    if candidate.job_id is not None:
        created_assignment = await _upsert_candidate_job_assignment(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            stage_id=candidate.stage_id,
            assignment_status="active",
            source=candidate.source,
            applied_at=None,
            assigned_at=candidate.updated_at,
        )

    # Store resume as a CandidateDocument (same pattern as existing document upload)
    doc_id = uuid7()
    object_key = (
        f"orgs/{current_user.org_id}/candidates/{candidate.id}/documents/{doc_id}_{safe_name}"
    )
    await storage_service.write_bytes(object_key, content, "application/pdf")
    resolved_url = await storage_service.resolve_url(object_key)

    document = CandidateDocument(
        id=doc_id,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        field_key="resume",
        field_label_snapshot="Resume",
        doc_type="resume",
        name=safe_name,
        url=resolved_url,
        object_key=object_key,
        mime_type="application/pdf",
        size_bytes=len(content),
        uploaded_by_user_id=current_user.id,
    )
    db.add(document)

    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="candidate_created",
        metadata={
            "job_id": str(candidate.job_id) if candidate.job_id else None,
            "source": candidate.source,
        },
    )
    await db.commit()

    if candidate.job_id is not None:
        stage_name = None
        if candidate.stage_id:
            stage_result = await db.execute(
                select(Stage.name).where(Stage.id == candidate.stage_id)
            )
            stage_name = stage_result.scalar_one_or_none()
        await execute_automations_for_trigger(
            db=db,
            trigger_key="candidate_applied",
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            metadata={
                "source": candidate.source,
                "stage_name": stage_name,
                "assigned_id": str(created_assignment.assigned_id) if created_assignment else None,
            },
        )

    return await get_candidate(candidate.id, db, current_user)


@router.get("", response_model=list[CandidateListItemResponse])
async def list_candidates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
    search: str | None = Query(default=None, max_length=200),
    job_id: UUID | None = None,
    stage_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=100),
    talent_pool_only: bool = Query(default=False),
    tag: str | None = Query(default=None, max_length=100),
    sort_by: str = Query(
        default="updated_at", pattern=r"^(updated_at|created_at|name|status|job_title|stage_name)$"
    ),
    sort_order: str = Query(default="desc", pattern=r"^(asc|desc)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    sort_expr_map = {
        "updated_at": Candidate.updated_at,
        "created_at": Candidate.created_at,
        "name": Candidate.name,
        "status": Candidate.status,
        "job_title": Job.title,
        "stage_name": Stage.name,
    }
    sort_expr = sort_expr_map[sort_by]
    sort_expr = sort_expr.desc() if sort_order == "desc" else sort_expr.asc()

    stmt = (
        select(Candidate, Job.title, Stage.name)
        .outerjoin(Job, Job.id == Candidate.job_id)
        .outerjoin(Stage, Stage.id == Candidate.stage_id)
        .where(Candidate.org_id == current_user.org_id)
        .order_by(sort_expr, Candidate.updated_at.desc(), Candidate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            Candidate.name.ilike(pattern)
            | Candidate.email.ilike(pattern)
            | Job.title.ilike(pattern)
        )
    if job_id:
        stmt = stmt.where(Candidate.job_id == job_id)
    if stage_id:
        stmt = stmt.where(Candidate.stage_id == stage_id)
    if status_filter:
        stmt = stmt.where(Candidate.status == status_filter)
    if source:
        stmt = stmt.where(Candidate.source == source)
    if talent_pool_only:
        stmt = stmt.where(Candidate.job_id.is_(None))
    if tag:
        stmt = stmt.where(Candidate.tags.contains([tag]))

    result = await db.execute(stmt)
    rows = result.all()
    assignment_map = await _load_candidate_assignments(
        db,
        org_id=current_user.org_id,
        candidate_ids=[c.id for c, _, _ in rows],
    )

    return [
        CandidateListItemResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            phone=c.phone,
            address=c.address,
            profile_links=dict(c.profile_links or {}),
            parsed_resume=c.parsed_resume if isinstance(c.parsed_resume, dict) else None,
            source=c.source,
            tags=list(c.tags or []),
            status=c.status,
            job_id=c.job_id,
            job_title=job_title,
            stage_id=c.stage_id,
            stage_name=stage_name,
            assignments=assignment_map.get(c.id, []),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, job_title, stage_name in rows
    ]


@router.get("/paginated", response_model=CandidateListResponse)
async def list_candidates_paginated(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
    search: str | None = Query(default=None, max_length=200),
    job_id: UUID | None = None,
    stage_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    source: str | None = Query(default=None, max_length=100),
    talent_pool_only: bool = Query(default=False),
    assigned_only: bool = Query(default=False),
    tag: str | None = Query(default=None, max_length=100),
    updated_from: str | None = Query(
        default=None,
        description="Inclusive lower bound on candidate updated_at (last activity), ISO 8601.",
    ),
    updated_to: str | None = Query(
        default=None,
        description="Inclusive upper bound on candidate updated_at (last activity), ISO 8601.",
    ),
    sort_by: str = Query(
        default="updated_at", pattern=r"^(updated_at|created_at|name|status|job_title|stage_name)$"
    ),
    sort_order: str = Query(default="desc", pattern=r"^(asc|desc)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    updated_from_dt = _parse_optional_iso_datetime_query(updated_from)
    updated_to_dt = _parse_optional_iso_datetime_query(updated_to)

    sort_expr_map = {
        "updated_at": Candidate.updated_at,
        "created_at": Candidate.created_at,
        "name": Candidate.name,
        "status": Candidate.status,
        "job_title": Job.title,
        "stage_name": Stage.name,
    }
    sort_expr = sort_expr_map[sort_by]
    sort_expr = sort_expr.desc() if sort_order == "desc" else sort_expr.asc()

    stmt = (
        select(Candidate, Job.title, Stage.name)
        .outerjoin(Job, Job.id == Candidate.job_id)
        .outerjoin(Stage, Stage.id == Candidate.stage_id)
        .where(Candidate.org_id == current_user.org_id)
        .order_by(sort_expr, Candidate.updated_at.desc(), Candidate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    count_stmt = (
        select(func.count(Candidate.id))
        .outerjoin(Job, Job.id == Candidate.job_id)
        .outerjoin(Stage, Stage.id == Candidate.stage_id)
        .where(Candidate.org_id == current_user.org_id)
    )

    if search:
        pattern = f"%{search.strip()}%"
        predicate = (
            Candidate.name.ilike(pattern)
            | Candidate.email.ilike(pattern)
            | Job.title.ilike(pattern)
        )
        stmt = stmt.where(predicate)
        count_stmt = count_stmt.where(predicate)
    if job_id:
        stmt = stmt.where(Candidate.job_id == job_id)
        count_stmt = count_stmt.where(Candidate.job_id == job_id)
    if stage_id:
        stmt = stmt.where(Candidate.stage_id == stage_id)
        count_stmt = count_stmt.where(Candidate.stage_id == stage_id)
    if status_filter:
        stmt = stmt.where(Candidate.status == status_filter)
        count_stmt = count_stmt.where(Candidate.status == status_filter)
    if source:
        stmt = stmt.where(Candidate.source == source)
        count_stmt = count_stmt.where(Candidate.source == source)
    if talent_pool_only:
        stmt = stmt.where(Candidate.job_id.is_(None))
        count_stmt = count_stmt.where(Candidate.job_id.is_(None))
    if assigned_only:
        stmt = stmt.where(Candidate.job_id.is_not(None))
        count_stmt = count_stmt.where(Candidate.job_id.is_not(None))
    if tag:
        stmt = stmt.where(Candidate.tags.contains([tag]))
        count_stmt = count_stmt.where(Candidate.tags.contains([tag]))
    if updated_from_dt is not None:
        stmt = stmt.where(Candidate.updated_at >= updated_from_dt)
        count_stmt = count_stmt.where(Candidate.updated_at >= updated_from_dt)
    if updated_to_dt is not None:
        stmt = stmt.where(Candidate.updated_at <= updated_to_dt)
        count_stmt = count_stmt.where(Candidate.updated_at <= updated_to_dt)

    result = await db.execute(stmt)
    rows = result.all()
    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    assignment_map = await _load_candidate_assignments(
        db,
        org_id=current_user.org_id,
        candidate_ids=[c.id for c, _, _ in rows],
    )

    return CandidateListResponse(
        items=[
            CandidateListItemResponse(
                id=c.id,
                name=c.name,
                email=c.email,
                phone=c.phone,
                address=c.address,
                profile_links=c.profile_links,
                parsed_resume=c.parsed_resume if isinstance(c.parsed_resume, dict) else None,
                source=c.source,
                tags=list(c.tags or []),
                status=c.status,
                job_id=c.job_id,
                job_title=job_title,
                stage_id=c.stage_id,
                stage_name=stage_name,
                assignments=assignment_map.get(c.id, []),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c, job_title, stage_name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/assignments/reconciliation-report")
async def candidate_jobs_reconciliation_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    missing_assignments_count = int(
        (
            await db.execute(
                select(func.count(Candidate.id))
                .outerjoin(
                    CandidateJobs,
                    (CandidateJobs.candidate_id == Candidate.id)
                    & (CandidateJobs.job_id == Candidate.job_id)
                    & (CandidateJobs.org_id == Candidate.org_id),
                )
                .where(
                    Candidate.org_id == current_user.org_id,
                    Candidate.job_id.is_not(None),
                    CandidateJobs.assigned_id.is_(None),
                )
            )
        ).scalar_one()
        or 0
    )

    stage_mismatch_count = int(
        (
            await db.execute(
                select(func.count(Candidate.id))
                .join(
                    CandidateJobs,
                    (CandidateJobs.candidate_id == Candidate.id)
                    & (CandidateJobs.job_id == Candidate.job_id)
                    & (CandidateJobs.org_id == Candidate.org_id),
                )
                .where(
                    Candidate.org_id == current_user.org_id,
                    Candidate.job_id.is_not(None),
                    Candidate.stage_id.is_not(None),
                    CandidateJobs.stage_id.is_not(None),
                    Candidate.stage_id != CandidateJobs.stage_id,
                )
            )
        ).scalar_one()
        or 0
    )

    total_assignments_count = int(
        (
            await db.execute(
                select(func.count(CandidateJobs.assigned_id)).where(
                    CandidateJobs.org_id == current_user.org_id
                )
            )
        ).scalar_one()
        or 0
    )
    candidate_with_legacy_job_count = int(
        (
            await db.execute(
                select(func.count(Candidate.id)).where(
                    Candidate.org_id == current_user.org_id,
                    Candidate.job_id.is_not(None),
                )
            )
        ).scalar_one()
        or 0
    )

    return {
        "candidate_jobs_enabled": True,
        "candidate_with_legacy_job_count": candidate_with_legacy_job_count,
        "candidate_jobs_rows": total_assignments_count,
        "missing_assignments_count": missing_assignments_count,
        "stage_mismatch_count": stage_mismatch_count,
    }


@router.get("/stage-filter-options", response_model=CandidateStageFilterOptionsResponse)
async def list_candidate_stage_filter_options(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    """Hiring stage names across the org, ordered by stage position (min position per name).

    When no jobs/stages exist, returns an empty list. Appends ``Hired`` / ``Rejected`` only
    when there are candidates in that status and the label is not already a stage name.
    """
    stmt = (
        select(Stage.name)
        .where(Stage.org_id == current_user.org_id)
        .group_by(Stage.name)
        .order_by(func.min(Stage.position).asc(), Stage.name.asc())
    )
    result = await db.execute(stmt)
    names = [row[0] for row in result.all()]
    name_set = set(names)

    if "Hired" not in name_set:
        hired_n = await db.scalar(
            select(func.count(Candidate.id)).where(
                Candidate.org_id == current_user.org_id,
                Candidate.status == "hired",
            )
        )
        if hired_n and hired_n > 0:
            names.append("Hired")
            name_set.add("Hired")

    if "Rejected" not in name_set:
        rejected_n = await db.scalar(
            select(func.count(Candidate.id)).where(
                Candidate.org_id == current_user.org_id,
                Candidate.status == "rejected",
            )
        )
        if rejected_n and rejected_n > 0:
            names.append("Rejected")
            name_set.add("Rejected")

    return CandidateStageFilterOptionsResponse(names=names)


@router.get("/{candidate_id}", response_model=CandidateDetailResponse)
async def get_candidate(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    result = await db.execute(
        select(Candidate, Job.title, Stage.name)
        .outerjoin(Job, Job.id == Candidate.job_id)
        .outerjoin(Stage, Stage.id == Candidate.stage_id)
        .where(Candidate.id == candidate_id, Candidate.org_id == current_user.org_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    c, job_title, stage_name = row
    profile_links = dict(c.profile_links or {})
    if not profile_links and c.job_id is not None:
        application_result = await db.execute(
            select(JobApplication)
            .where(
                JobApplication.org_id == current_user.org_id,
                JobApplication.candidate_id == c.id,
            )
            .order_by(JobApplication.created_at.desc())
            .limit(1)
        )
        application = application_result.scalar_one_or_none()
        if application is None:
            fallback_result = await db.execute(
                select(JobApplication)
                .where(
                    JobApplication.org_id == current_user.org_id,
                    JobApplication.job_id == c.job_id,
                    func.lower(JobApplication.email) == (c.email or "").strip().lower(),
                )
                .order_by(JobApplication.created_at.desc())
                .limit(1)
            )
            application = fallback_result.scalar_one_or_none()
        if application is not None:
            profile_links = _extract_profile_links_from_application(
                application.schema_snapshot, application.answers
            )
    return CandidateDetailResponse(
        id=c.id,
        name=c.name,
        email=c.email,
        phone=c.phone,
        address=c.address,
        profile_links=profile_links,
        parsed_resume=c.parsed_resume if isinstance(c.parsed_resume, dict) else None,
        source=c.source,
        tags=list(c.tags or []),
        status=c.status,
        job_id=c.job_id,
        job_title=job_title,
        stage_id=c.stage_id,
        stage_name=stage_name,
        assignments=(
            await _load_candidate_assignments(
                db,
                org_id=current_user.org_id,
                candidate_ids=[c.id],
            )
        ).get(c.id, []),
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get(
    "/{candidate_id}/application-responses",
    response_model=CandidateApplicationResponsesResponse,
)
async def get_candidate_application_responses(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if candidate.job_id is None:
        return CandidateApplicationResponsesResponse(
            submitted_at=None,
            has_additional_questions=False,
            items=[],
        )

    # Prefer explicit candidate linkage; fallback to org+job+email for older rows.
    app_result = await db.execute(
        select(JobApplication)
        .where(
            JobApplication.org_id == current_user.org_id,
            JobApplication.candidate_id == candidate.id,
        )
        .order_by(JobApplication.created_at.desc())
        .limit(1)
    )
    application = app_result.scalar_one_or_none()
    if application is None:
        fallback_result = await db.execute(
            select(JobApplication)
            .where(
                JobApplication.org_id == current_user.org_id,
                JobApplication.job_id == candidate.job_id,
                func.lower(JobApplication.email) == (candidate.email or "").strip().lower(),
            )
            .order_by(JobApplication.created_at.desc())
            .limit(1)
        )
        application = fallback_result.scalar_one_or_none()

    if application is None:
        return CandidateApplicationResponsesResponse(
            submitted_at=None,
            has_additional_questions=False,
            items=[],
        )

    schema_snapshot = dict(application.schema_snapshot or {})
    questions = _iter_application_custom_questions(schema_snapshot)
    answers = dict(application.answers or {})
    files = dict(application.files or {})

    items: list[CandidateApplicationResponseItem] = []
    for key, label, field_type, required in questions:
        if field_type == "file_upload":
            raw_file_value = files.get(key)
            file_refs: list[str] = []
            if isinstance(raw_file_value, list):
                file_refs = [str(item).strip() for item in raw_file_value if str(item).strip()]
            elif isinstance(raw_file_value, str) and raw_file_value.strip():
                file_refs = [raw_file_value.strip()]
            resolved_files: list[CandidateApplicationResponseFile] = []
            for file_ref in file_refs:
                file_obj = await _resolve_application_file_link(file_ref)
                if file_obj is not None:
                    resolved_files.append(file_obj)
            items.append(
                CandidateApplicationResponseItem(
                    key=key,
                    label=label,
                    type=field_type,
                    required=required,
                    response=None,
                    files=resolved_files,
                )
            )
            continue

        response_value = _application_response_value(field_type, answers.get(key))
        items.append(
            CandidateApplicationResponseItem(
                key=key,
                label=label,
                type=field_type,
                required=required,
                response=response_value,
                files=[],
            )
        )

    return CandidateApplicationResponsesResponse(
        submitted_at=application.created_at,
        has_additional_questions=len(questions) > 0,
        items=items,
    )


@router.patch("/{candidate_id}", response_model=CandidateDetailResponse)
async def update_candidate(
    candidate_id: UUID,
    body: CandidateUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    # Track if job was assigned (from None to a job_id)
    old_job_id = candidate.job_id
    changed_fields: list[str] = []
    job_changed = False
    job_was_assigned = False
    assigned_job_assignment: CandidateJobs | None = None

    if body.name is not None:
        next_name = body.name.strip()
        if candidate.name != next_name:
            candidate.name = next_name
            changed_fields.append("name")
    if body.email is not None:
        next_email = body.email.strip().lower()
        if candidate.email != next_email:
            candidate.email = next_email
            changed_fields.append("email")
    if body.phone is not None:
        next_phone = body.phone.strip() or None
        if candidate.phone != next_phone:
            candidate.phone = next_phone
            changed_fields.append("phone")
    if body.address is not None:
        next_address = body.address.strip() or None
        if candidate.address != next_address:
            candidate.address = next_address
            changed_fields.append("address")
    if body.profile_links is not None:
        normalized_links: dict[str, str] = {}
        for k, v in (body.profile_links or {}).items():
            key = (k or "").strip()
            value = (v or "").strip()
            if key and value:
                normalized_links[key] = value
        if (candidate.profile_links or {}) != normalized_links:
            candidate.profile_links = normalized_links
            changed_fields.append("profile_links")

    if body.clear_job:
        cleared_job_id = candidate.job_id
        candidate.job_id = None
        candidate.stage_id = None
        if cleared_job_id is not None:
            changed_fields.extend(["job_id", "stage_id"])
            job_changed = True
        if cleared_job_id is not None:
            existing_assignment_result = await db.execute(
                select(CandidateJobs).where(
                    CandidateJobs.org_id == current_user.org_id,
                    CandidateJobs.candidate_id == candidate.id,
                    CandidateJobs.job_id == cleared_job_id,
                )
            )
            existing_assignment = existing_assignment_result.scalar_one_or_none()
            if existing_assignment is not None:
                existing_assignment.assignment_status = "withdrawn"
                existing_assignment.assigned_at = datetime.now(timezone.utc)
    elif body.job_id is not None:
        job_result = await db.execute(
            select(Job).where(Job.id == body.job_id, Job.org_id == current_user.org_id)
        )
        job = job_result.scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        if candidate.job_id != body.job_id:
            # Job is being assigned or changed
            if old_job_id is None and body.job_id is not None:
                job_was_assigned = True  # Talent pool candidate assigned to job

            candidate.job_id = body.job_id
            changed_fields.append("job_id")
            job_changed = True
            first_stage_result = await db.execute(
                select(Stage)
                .where(Stage.org_id == current_user.org_id, Stage.job_id == body.job_id)
                .order_by(Stage.position.asc())
                .limit(1)
            )
            first_stage = first_stage_result.scalar_one_or_none()
            candidate.stage_id = first_stage.id if first_stage else None
            changed_fields.append("stage_id")
            assigned_job_assignment = await _upsert_candidate_job_assignment(
                db,
                org_id=current_user.org_id,
                candidate_id=candidate.id,
                job_id=body.job_id,
                stage_id=candidate.stage_id,
                assignment_status=candidate.status
                if candidate.status in {"active", "rejected", "hired"}
                else "active",
                source=candidate.source,
                assigned_at=datetime.now(timezone.utc),
            )

    if changed_fields:
        metadata: dict[str, Any] = {"changed_fields": changed_fields}
        if job_changed:
            metadata.update(
                {
                    "job_changed": True,
                    "old_job_id": str(old_job_id) if old_job_id else None,
                    "new_job_id": str(candidate.job_id) if candidate.job_id else None,
                }
            )
        await _log_activity(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            created_by_user_id=current_user.id,
            activity_type="candidate_updated",
            metadata=metadata,
        )
    await db.commit()

    # Trigger candidate_job_assigned automation when talent pool candidate gets a job
    if job_was_assigned:
        # Fetch job and stage details for metadata
        job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
        job = job_result.scalar_one_or_none()

        stage_name = None
        if candidate.stage_id:
            stage_result = await db.execute(
                select(Stage.name).where(Stage.id == candidate.stage_id)
            )
            stage_name = stage_result.scalar_one_or_none()

        try:
            await execute_automations_for_trigger(
                db=db,
                trigger_key="candidate_job_assigned",
                org_id=current_user.org_id,
                candidate_id=candidate.id,
                job_id=candidate.job_id,
                metadata={
                    "job_title": job.title if job else None,
                    "stage_name": stage_name,
                    "source": candidate.source,
                    "assigned_id": str(assigned_job_assignment.assigned_id)
                    if assigned_job_assignment
                    else None,
                },
            )
            logger.info(
                f"Triggered candidate_job_assigned automation: candidate_id={candidate.id}, job_id={candidate.job_id}"
            )
        except Exception as e:
            logger.error(
                f"Failed to trigger candidate_job_assigned automation: {e}",
                exc_info=True,
            )

    return await get_candidate(candidate.id, db, current_user)


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    inv_ids_result = await db.execute(
        select(Interview.id).where(Interview.candidate_id == candidate_id)
    )
    inv_ids = [row[0] for row in inv_ids_result.all()]
    if inv_ids:
        await db.execute(delete(Feedback).where(Feedback.interview_id.in_(inv_ids)))
    await db.execute(delete(Interview).where(Interview.candidate_id == candidate_id))

    await db.execute(delete(Activity).where(Activity.candidate_id == candidate_id))
    await db.execute(delete(Note).where(Note.candidate_id == candidate_id))
    await db.execute(
        delete(CandidateJobs).where(
            CandidateJobs.org_id == current_user.org_id, CandidateJobs.candidate_id == candidate_id
        )
    )

    doc_rows = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.org_id == current_user.org_id,
            CandidateDocument.is_deleted.is_(False),
        )
    )
    for doc in doc_rows.scalars():
        if (doc.object_key or "").strip():
            try:
                await storage_service.delete_object(doc.object_key)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "delete_object failed candidate_id=%s key=%s err=%s",
                    candidate_id,
                    doc.object_key,
                    exc,
                )

    await db.execute(
        delete(CandidateDocument).where(
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.org_id == current_user.org_id,
        )
    )

    await db.execute(
        update(AutomationExecution)
        .where(AutomationExecution.candidate_id == candidate_id)
        .values(candidate_id=None)
    )

    await db.delete(candidate)
    await db.commit()


@router.patch("/{candidate_id}/stage", response_model=CandidateDetailResponse)
async def update_candidate_stage(
    candidate_id: UUID,
    body: CandidateStageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:stage_update")),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    target_job_id = body.job_id or candidate.job_id
    if target_job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate has no job context for stage move",
        )
    assignment: CandidateJobs | None = None
    assignment_result = await db.execute(
        select(CandidateJobs).where(
            CandidateJobs.org_id == current_user.org_id,
            CandidateJobs.candidate_id == candidate.id,
            CandidateJobs.job_id == target_job_id,
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate is not assigned to this job",
        )

    stage_result = await db.execute(
        select(Stage).where(
            Stage.id == body.stage_id,
            Stage.org_id == current_user.org_id,
            Stage.job_id == target_job_id,
        )
    )
    stage = stage_result.scalar_one_or_none()
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage for candidate job"
        )

    if assignment is not None:
        assignment.stage_id = stage.id
        assignment.assignment_status = "active"
        assignment.assigned_at = datetime.now(timezone.utc)
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="stage_changed",
        metadata={"stage_id": str(stage.id), "stage_name": stage.name},
    )
    await db.commit()

    # Trigger automations for candidate_moved
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_moved",
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        job_id=target_job_id,
        metadata={
            "stage_id": str(stage.id),
            "stage_name": stage.name,
        },
    )

    return await get_candidate(candidate_id, db, current_user)


@router.patch("/{candidate_id}/status", response_model=CandidateDetailResponse)
async def update_candidate_status(
    candidate_id: UUID,
    body: CandidateStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:stage_update")),
):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    target_job_id = body.job_id or candidate.job_id
    assignment: CandidateJobs | None = None
    if target_job_id is not None:
        assignment_result = await db.execute(
            select(CandidateJobs).where(
                CandidateJobs.org_id == current_user.org_id,
                CandidateJobs.candidate_id == candidate.id,
                CandidateJobs.job_id == target_job_id,
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate is not assigned to this job",
            )

    # Idempotency check: prevent duplicate status updates and automation triggers
    current_status = assignment.assignment_status if assignment is not None else candidate.status
    if current_status == body.status:
        logger.info(f"Candidate {candidate_id} already has status '{body.status}', skipping update")
        return await get_candidate(candidate_id, db, current_user)

    # Validation: Cannot reject candidate without job assignment
    if body.status == "rejected" and target_job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject candidate without job assignment. Rejection is per-job basis.",
        )

    # Store old status for logging
    old_status = current_status
    if assignment is not None:
        assignment.assignment_status = body.status
        assignment.assigned_at = datetime.now(timezone.utc)
        if body.status in {"rejected", "hired"}:
            terminal_stage_name = "rejected" if body.status == "rejected" else "hired"
            terminal_stage_result = await db.execute(
                select(Stage)
                .where(
                    Stage.org_id == current_user.org_id,
                    Stage.job_id == target_job_id,
                    func.lower(Stage.name) == terminal_stage_name,
                )
                .limit(1)
            )
            terminal_stage = terminal_stage_result.scalar_one_or_none()
            if terminal_stage is not None:
                assignment.stage_id = terminal_stage.id
                candidate.stage_id = (
                    terminal_stage.id if candidate.job_id == target_job_id else candidate.stage_id
                )
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="status_changed",
        metadata={"old_status": old_status, "new_status": body.status},
    )
    await db.commit()

    # Trigger automations only when status actually changes
    if body.status == "rejected":
        await execute_automations_for_trigger(
            db=db,
            trigger_key="candidate_rejected",
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=target_job_id,
            metadata={
                "status": "rejected",
                "job_id": str(target_job_id) if target_job_id else None,
            },
        )
    elif body.status == "hired":
        await execute_automations_for_trigger(
            db=db,
            trigger_key="candidate_hired",
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            job_id=target_job_id,
            metadata={"status": "hired", "job_id": str(target_job_id) if target_job_id else None},
        )

    return await get_candidate(candidate_id, db, current_user)


@router.patch("/actions/bulk/stage", response_model=CandidateBulkUpdateResponse)
async def bulk_update_candidate_stage(
    body: CandidateBulkStageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:stage_update")),
):
    ids = list(dict.fromkeys(body.candidate_ids))
    result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == current_user.org_id,
            Candidate.id.in_(ids),
        )
    )
    candidates = result.scalars().all()
    if not candidates:
        return CandidateBulkUpdateResponse(updated_count=0)

    for candidate in candidates:
        if candidate.job_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate has no job context for stage move: {candidate.id}",
            )
        stage_result = await db.execute(
            select(Stage).where(
                Stage.id == body.stage_id,
                Stage.org_id == current_user.org_id,
                Stage.job_id == candidate.job_id,
            )
        )
        stage = stage_result.scalar_one_or_none()
        if stage is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid stage for candidate job: {candidate.id}",
            )
        candidate.stage_id = stage.id
        await _log_activity(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            created_by_user_id=current_user.id,
            activity_type="bulk_stage_changed",
            metadata={"stage_id": str(stage.id), "stage_name": stage.name},
        )

    await db.commit()
    return CandidateBulkUpdateResponse(updated_count=len(candidates))


@router.patch("/actions/bulk/status", response_model=CandidateBulkUpdateResponse)
async def bulk_update_candidate_status(
    body: CandidateBulkStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:stage_update")),
):
    ids = list(dict.fromkeys(body.candidate_ids))
    result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == current_user.org_id,
            Candidate.id.in_(ids),
        )
    )
    candidates = result.scalars().all()
    for candidate in candidates:
        candidate.status = body.status
        await _log_activity(
            db,
            org_id=current_user.org_id,
            candidate_id=candidate.id,
            created_by_user_id=current_user.id,
            activity_type="bulk_status_changed",
            metadata={"status": body.status},
        )
    await db.commit()
    return CandidateBulkUpdateResponse(updated_count=len(candidates))


@router.patch("/actions/bulk/assign-job", response_model=CandidateBulkUpdateResponse)
async def bulk_assign_candidates_to_job(
    body: CandidateBulkAssignJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    ids = list(dict.fromkeys(body.candidate_ids))

    job_result = await db.execute(
        select(Job).where(Job.id == body.job_id, Job.org_id == current_user.org_id)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    first_stage_result = await db.execute(
        select(Stage)
        .where(Stage.org_id == current_user.org_id, Stage.job_id == body.job_id)
        .order_by(Stage.position.asc())
        .limit(1)
    )
    first_stage = first_stage_result.scalar_one_or_none()

    result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == current_user.org_id,
            Candidate.id.in_(ids),
        )
    )
    candidates = result.scalars().all()
    if not candidates:
        return CandidateBulkUpdateResponse(updated_count=0)

    # Track which candidates are “newly assigned” (Talent Pool -> Job) to trigger automation.
    newly_assigned: list[tuple[UUID, UUID | None]] = []

    for candidate in candidates:
        old_job_id = candidate.job_id
        if old_job_id != body.job_id:
            if old_job_id is None:
                newly_assigned.append((candidate.id, None))
            candidate.job_id = body.job_id
            candidate.stage_id = first_stage.id if first_stage else None
            assigned_id: UUID | None = None
            assignment = await _upsert_candidate_job_assignment(
                db,
                org_id=current_user.org_id,
                candidate_id=candidate.id,
                job_id=body.job_id,
                stage_id=candidate.stage_id,
                assignment_status=candidate.status
                if candidate.status in {"active", "rejected", "hired"}
                else "active",
                source=candidate.source,
                assigned_at=datetime.now(timezone.utc),
            )
            assigned_id = assignment.assigned_id

            if old_job_id is None and assigned_id is not None:
                newly_assigned[-1] = (candidate.id, assigned_id)
            await _log_activity(
                db,
                org_id=current_user.org_id,
                candidate_id=candidate.id,
                created_by_user_id=current_user.id,
                activity_type="bulk_job_assigned",
                metadata={
                    "job_id": str(body.job_id),
                    "job_title": job.title,
                    "stage_id": str(candidate.stage_id) if candidate.stage_id else None,
                    "stage_name": first_stage.name if first_stage else None,
                },
            )

    await db.commit()

    # Trigger automations for candidates assigned from talent pool.
    if newly_assigned:
        for candidate_id, assigned_id in newly_assigned:
            try:
                await execute_automations_for_trigger(
                    db=db,
                    trigger_key="candidate_job_assigned",
                    org_id=current_user.org_id,
                    candidate_id=candidate_id,
                    job_id=body.job_id,
                    metadata={
                        "job_title": job.title,
                        "stage_name": first_stage.name if first_stage else None,
                        "assigned_id": str(assigned_id) if assigned_id else None,
                    },
                )
            except Exception as e:
                logger.error(
                    "Failed to trigger candidate_job_assigned automation bulk candidate_id=%s err=%s",
                    candidate_id,
                    e,
                    exc_info=True,
                )

    return CandidateBulkUpdateResponse(updated_count=len(candidates))


@router.get("/{candidate_id}/overview", response_model=CandidateOverviewResponse)
async def get_candidate_overview(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    candidate_result = await db.execute(
        select(Candidate.id).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    if candidate_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    note_author = aliased(User)
    notes_result = await db.execute(
        select(Note, note_author.name)
        .join(note_author, note_author.id == Note.author_user_id)
        .where(Note.org_id == current_user.org_id, Note.candidate_id == candidate_id)
        .order_by(Note.created_at.desc())
    )

    activity_author = aliased(User)
    activities_result = await db.execute(
        select(Activity, activity_author.name)
        .join(activity_author, activity_author.id == Activity.created_by_user_id)
        .where(Activity.org_id == current_user.org_id, Activity.candidate_id == candidate_id)
        .order_by(Activity.created_at.desc())
    )

    return CandidateOverviewResponse(
        notes=[
            CandidateNoteResponse(
                id=note.id,
                author_user_id=note.author_user_id,
                author_name=author_name,
                content=note.content,
                mentions=_serialize_note_mentions(note.mentions),
                created_at=note.created_at,
            )
            for note, author_name in notes_result.all()
        ],
        activities=[
            CandidateActivityResponse(
                id=activity.id,
                type=activity.type,
                metadata=activity.metadata_ or {},
                created_by_user_id=activity.created_by_user_id,
                created_by_name=author_name,
                created_at=activity.created_at,
            )
            for activity, author_name in activities_result.all()
        ],
    )


@router.post(
    "/{candidate_id}/notes",
    response_model=CandidateNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_candidate_note(
    candidate_id: UUID,
    body: CandidateNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:feedback")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    note_content = body.content.strip()
    if not note_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Note content is required",
        )

    note = Note(
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        author_user_id=current_user.id,
        content=note_content,
        mentions=[],
    )
    resolved_mentions = await _resolve_note_mentions(
        db,
        org_id=current_user.org_id,
        mention_ids=list(body.mentions or []),
    )
    note.mentions = [
        {
            "user_id": str(mention.user_id),
            "name": mention.name,
            "email": mention.email,
        }
        for mention in resolved_mentions
    ]
    db.add(note)
    await db.flush()
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="note_added",
        metadata={
            "note_id": str(note.id),
            "mentioned_user_ids": [str(mention.user_id) for mention in resolved_mentions],
        },
    )
    await db.commit()
    candidate_url = _candidate_note_url(candidate)
    note_excerpt = _candidate_note_excerpt(note.content)
    for mention in resolved_mentions:
        if mention.user_id == current_user.id:
            continue
        try:
            await send_candidate_note_mention_email(
                to_email=mention.email,
                recipient_name=mention.name or mention.email,
                author_name=current_user.name,
                candidate_name=candidate.name,
                candidate_url=candidate_url,
                note_excerpt=note_excerpt,
                org_id=current_user.org_id,
                db=db,
            )
        except Exception:
            # Note persistence succeeds even when notification delivery fails.
            logger.exception(
                "Failed to send candidate note mention email note_id=%s user_id=%s",
                note.id,
                mention.user_id,
            )
    return CandidateNoteResponse(
        id=note.id,
        author_user_id=note.author_user_id,
        author_name=current_user.name,
        content=note.content,
        mentions=resolved_mentions,
        created_at=note.created_at,
    )


@router.get("/{candidate_id}/interviews", response_model=list[CandidateInterviewResponse])
async def list_candidate_interviews(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    result = await db.execute(
        select(Interview)
        .where(Interview.org_id == current_user.org_id, Interview.candidate_id == candidate_id)
        .order_by(Interview.scheduled_at.desc())
    )
    interviews = result.scalars().all()
    return [
        CandidateInterviewResponse(
            id=i.id,
            title=f"Interview ({i.duration_minutes or 0}m)",
            scheduled_at=i.scheduled_at,
            duration_minutes=i.duration_minutes,
            meeting_link=i.meeting_link,
            interviewer_ids=list(i.interviewer_ids or []),
            created_at=i.created_at,
            updated_at=i.updated_at,
        )
        for i in interviews
    ]


@router.post(
    "/{candidate_id}/interviews",
    response_model=CandidateInterviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_candidate_interview(
    candidate_id: UUID,
    body: CandidateInterviewCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("interviews:schedule")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if candidate.job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assign candidate to a job before scheduling interview",
        )

    interview = Interview(
        org_id=current_user.org_id,
        job_id=candidate.job_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
        meeting_link=body.meeting_link,
        interviewer_ids=list(body.interviewer_ids),
    )
    db.add(interview)
    await db.flush()
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="interview_scheduled",
        metadata={"interview_id": str(interview.id)},
    )
    await db.commit()
    return CandidateInterviewResponse(
        id=interview.id,
        title=body.title,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        meeting_link=interview.meeting_link,
        interviewer_ids=list(interview.interviewer_ids or []),
        created_at=interview.created_at,
        updated_at=interview.updated_at,
    )


@router.post(
    "/{candidate_id}/interviews/{interview_id}/feedback",
    response_model=CandidateFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_candidate_feedback(
    candidate_id: UUID,
    interview_id: UUID,
    body: CandidateFeedbackCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("interviews:feedback")),
):
    interview_result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.candidate_id == candidate_id,
            Interview.org_id == current_user.org_id,
        )
    )
    interview = interview_result.scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

    feedback = Feedback(
        org_id=current_user.org_id,
        interview_id=interview.id,
        reviewer_user_id=current_user.id,
        rating=body.rating,
        decision=body.decision,
        comments=body.comments,
    )
    db.add(feedback)
    await db.flush()
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate_id,
        created_by_user_id=current_user.id,
        activity_type="feedback_submitted",
        metadata={"interview_id": str(interview_id), "feedback_id": str(feedback.id)},
    )
    await db.commit()
    return CandidateFeedbackResponse(
        id=feedback.id,
        interview_id=feedback.interview_id,
        reviewer_user_id=feedback.reviewer_user_id,
        reviewer_name=current_user.name,
        rating=feedback.rating,
        decision=feedback.decision,
        comments=feedback.comments,
        created_at=feedback.created_at,
    )


@router.get("/{candidate_id}/evaluation", response_model=CandidateEvaluationResponse)
async def get_candidate_evaluation(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    reviewer = aliased(User)
    result = await db.execute(
        select(Feedback, reviewer.name)
        .join(Interview, Interview.id == Feedback.interview_id)
        .join(reviewer, reviewer.id == Feedback.reviewer_user_id)
        .where(
            Feedback.org_id == current_user.org_id,
            Interview.candidate_id == candidate_id,
            Interview.org_id == current_user.org_id,
        )
        .order_by(Feedback.created_at.desc())
    )
    rows = result.all()
    feedback_items = [
        CandidateFeedbackResponse(
            id=f.id,
            interview_id=f.interview_id,
            reviewer_user_id=f.reviewer_user_id,
            reviewer_name=reviewer_name,
            rating=f.rating,
            decision=f.decision,
            comments=f.comments,
            created_at=f.created_at,
        )
        for f, reviewer_name in rows
    ]

    ratings = [f.rating for f, _ in rows if f.rating is not None]
    avg = float(sum(ratings) / len(ratings)) if ratings else 0.0
    counts = {"yes": 0, "no": 0, "maybe": 0}
    for f, _ in rows:
        counts[f.decision] = counts.get(f.decision, 0) + 1

    return CandidateEvaluationResponse(
        average_rating=avg,
        counts=counts,
        feedback=feedback_items,
    )


@router.get("/{candidate_id}/documents", response_model=list[CandidateDocumentResponse])
async def list_candidate_documents(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    doc_author = aliased(User)
    docs_result = await db.execute(
        select(CandidateDocument, doc_author.name)
        .outerjoin(doc_author, doc_author.id == CandidateDocument.uploaded_by_user_id)
        .where(
            CandidateDocument.org_id == current_user.org_id,
            CandidateDocument.candidate_id == candidate.id,
            CandidateDocument.is_deleted.is_(False),
        )
        .order_by(CandidateDocument.created_at.desc())
    )
    items: list[CandidateDocumentResponse] = []
    for doc, author_name in docs_result.all():
        items.append(
            CandidateDocumentResponse(
                id=doc.id,
                field_key=doc.field_key,
                name=doc.name,
                url=await _resolve_candidate_document_url(doc),
                object_key=doc.object_key,
                mime_type=doc.mime_type,
                size_bytes=int(doc.size_bytes or 0),
                doc_type=doc.doc_type,
                size_label=f"{round((doc.size_bytes or 0) / 1024, 1)} KB"
                if doc.size_bytes
                else None,
                created_by_user_id=doc.uploaded_by_user_id,
                created_by_name=author_name,
                created_at=doc.created_at,
            )
        )
    return items


@router.get("/{candidate_id}/documents/{document_id}/preview")
async def preview_candidate_document_inline(
    candidate_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:read")),
):
    candidate_result = await db.execute(
        select(Candidate.id).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    if candidate_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    doc_result = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.id == document_id,
            CandidateDocument.org_id == current_user.org_id,
            CandidateDocument.candidate_id == candidate_id,
            CandidateDocument.is_deleted.is_(False),
        )
    )
    doc = doc_result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Inline preview is only supported for PDFs. We intentionally accept common cases where
    # the stored MIME type is inaccurate (e.g., application/octet-stream) but the filename
    # indicates a PDF.
    mime = (doc.mime_type or "").strip().lower()
    name = (doc.name or "").strip().lower()
    is_pdf = mime == "application/pdf" or name.endswith(".pdf")
    if not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Preview is only available for PDF documents",
        )

    normalized_key = (doc.object_key or "").strip() or _object_key_from_stored_file_url(doc.url)
    if not normalized_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    normalized_key = normalized_key.lstrip("/")
    org_prefix = f"orgs/{current_user.org_id}/"
    if not normalized_key.startswith(org_prefix):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return await _stream_candidate_pdf_inline(normalized_key=normalized_key, filename=doc.name)


@router.post(
    "/{candidate_id}/documents/upload-temp",
    status_code=status.HTTP_200_OK,
)
async def upload_temp_message_attachment(
    candidate_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    """Upload a file to a temporary S3 prefix for use as a message attachment.

    The file is stored under orgs/{org_id}/temp/{uuid}_{filename} and is NOT
    written to the DB. The caller must include the returned s3_key when sending
    the message. Lifecycle cleanup of orphaned temp files is handled by an S3
    lifecycle rule (to be configured separately).
    """
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    if candidate_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    content = await file.read()
    max_b = 10 * 1024 * 1024  # 10 MB per attachment
    if len(content) > max_b:
        raise HTTPException(status_code=422, detail="Attachment size must be <= 10 MB")
    safe_name = (file.filename or "attachment").strip()
    mime_type = (file.content_type or "application/octet-stream").strip()
    file_id = uuid7()
    s3_key = f"orgs/{current_user.org_id}/temp/{file_id}_{safe_name}"
    await storage_service.write_bytes(s3_key, content, mime_type)

    return {
        "s3_key": s3_key,
        "filename": safe_name,
        "mime_type": mime_type,
        "size": len(content),
    }


@router.post(
    "/{candidate_id}/documents/upload",
    response_model=CandidateDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_candidate_document(
    candidate_id: UUID,
    file: UploadFile = File(...),
    doc_type: str = Form(default="custom_field_attachment"),
    field_key: str = Form(default="attachment"),
    field_label: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    ensure_pdf_type(file.content_type)
    content = await read_upload_with_size_check(file)
    safe_name = (file.filename or "document.pdf").strip()
    doc_id = uuid7()
    object_key = (
        f"orgs/{current_user.org_id}/candidates/{candidate.id}/documents/{doc_id}_{safe_name}"
    )
    await storage_service.write_bytes(object_key, content, "application/pdf")
    resolved_url = await storage_service.resolve_url(object_key)

    document = CandidateDocument(
        id=doc_id,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        field_key=(field_key or "attachment").strip() or "attachment",
        field_label_snapshot=(field_label or "").strip() or None,
        doc_type=(doc_type or "custom_field_attachment").strip() or "custom_field_attachment",
        name=safe_name,
        url=resolved_url,
        object_key=object_key,
        mime_type="application/pdf",
        size_bytes=len(content),
        uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="document_added",
        metadata={
            "document_id": str(doc_id),
            "field_key": (field_key or "attachment").strip() or "attachment",
            "doc_type": (doc_type or "custom_field_attachment").strip()
            or "custom_field_attachment",
        },
    )
    await db.commit()
    await db.refresh(document)

    return CandidateDocumentResponse(
        id=document.id,
        field_key=document.field_key,
        name=document.name,
        url=resolved_url,
        object_key=document.object_key,
        mime_type=document.mime_type,
        size_bytes=int(document.size_bytes),
        doc_type=document.doc_type,
        size_label=f"{round(len(content) / 1024, 1)} KB",
        created_by_user_id=current_user.id,
        created_by_name=current_user.name,
        created_at=document.created_at or datetime.now(timezone.utc),
    )


@router.delete("/{candidate_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate_document(
    candidate_id: UUID,
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("candidates:source")),
):
    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.org_id == current_user.org_id
        )
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    document_result = await db.execute(
        select(CandidateDocument).where(
            CandidateDocument.id == document_id,
            CandidateDocument.org_id == current_user.org_id,
            CandidateDocument.candidate_id == candidate.id,
            CandidateDocument.is_deleted.is_(False),
        )
    )
    document = document_result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await storage_service.delete_object(document.object_key)
    document.is_deleted = True
    document.deleted_at = datetime.now(timezone.utc)
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="document_deleted",
        metadata={"document_id": str(document.id), "field_key": document.field_key},
    )
    await db.commit()
