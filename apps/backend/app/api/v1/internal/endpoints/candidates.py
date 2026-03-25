from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
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
from app.models.candidate_document import CandidateDocument
from app.models.email import Email
from app.models.feedback import Feedback
from app.models.interview import Interview
from app.models.job import Job
from app.models.note import Note
from app.models.org_membership import OrgMembership
from app.models.stage import Stage
from app.models.user import User
from app.schemas.candidates import (
    CandidateActivityResponse,
    CandidateBulkStageUpdateRequest,
    CandidateBulkStatusUpdateRequest,
    CandidateBulkUpdateResponse,
    CandidateCreateRequest,
    CandidateDetailResponse,
    CandidateDocumentResponse,
    CandidateEvaluationResponse,
    CandidateFeedbackCreateRequest,
    CandidateFeedbackResponse,
    CandidateInterviewCreateRequest,
    CandidateInterviewResponse,
    CandidateListItemResponse,
    CandidateListResponse,
    CandidateStageFilterOptionsResponse,
    CandidateNoteMentionResponse,
    CandidateNoteRequest,
    CandidateNoteResponse,
    CandidateOverviewResponse,
    CandidateStageUpdateRequest,
    CandidateStatusUpdateRequest,
    CandidateUpdateRequest,
)
from app.services.email import send_candidate_note_mention_email
from app.services.media import ensure_pdf_type, read_upload_with_size_check
from app.services.storage import storage_service
from app.utils.uuid import uuid7

router = APIRouter(prefix="/candidates", tags=["candidates"])


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


def _candidate_note_url(candidate_id: UUID) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/candidates/{candidate_id}"


def _candidate_note_excerpt(content: str, limit: int = 280) -> str:
    compact = " ".join(content.split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 1].rstrip()}…"


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
        location=(body.location or "").strip() or None,
        profile_links=dict(body.profile_links or {}),
        source=(body.source or "manual").strip() or "manual",
        tags=list(body.tags or []),
    )
    db.add(candidate)
    await db.flush()
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
    if tag:
        stmt = stmt.where(Candidate.tags.contains([tag]))

    result = await db.execute(stmt)
    rows = result.all()

    return [
        CandidateListItemResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            phone=c.phone,
            location=c.location,
            profile_links=dict(c.profile_links or {}),
            source=c.source,
            tags=list(c.tags or []),
            status=c.status,
            job_id=c.job_id,
            job_title=job_title,
            stage_id=c.stage_id,
            stage_name=stage_name,
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
    if tag:
        stmt = stmt.where(Candidate.tags.contains([tag]))
        count_stmt = count_stmt.where(Candidate.tags.contains([tag]))

    result = await db.execute(stmt)
    rows = result.all()
    total = int((await db.execute(count_stmt)).scalar_one() or 0)

    return CandidateListResponse(
        items=[
            CandidateListItemResponse(
                id=c.id,
                name=c.name,
                email=c.email,
                phone=c.phone,
                location=c.location,
                profile_links=dict(c.profile_links or {}),
                source=c.source,
                tags=list(c.tags or []),
                status=c.status,
                job_id=c.job_id,
                job_title=job_title,
                stage_id=c.stage_id,
                stage_name=stage_name,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c, job_title, stage_name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


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
    return CandidateDetailResponse(
        id=c.id,
        name=c.name,
        email=c.email,
        phone=c.phone,
        location=c.location,
        profile_links=dict(c.profile_links or {}),
        source=c.source,
        tags=list(c.tags or []),
        status=c.status,
        job_id=c.job_id,
        job_title=job_title,
        stage_id=c.stage_id,
        stage_name=stage_name,
        created_at=c.created_at,
        updated_at=c.updated_at,
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

    if body.name is not None:
        candidate.name = body.name.strip()
    if body.email is not None:
        candidate.email = body.email.strip().lower()
    if body.phone is not None:
        candidate.phone = body.phone.strip() or None
    if body.location is not None:
        candidate.location = body.location.strip() or None
    if body.profile_links is not None:
        normalized_links: dict[str, str] = {}
        for k, v in (body.profile_links or {}).items():
            key = (k or "").strip()
            value = (v or "").strip()
            if key and value:
                normalized_links[key] = value
        candidate.profile_links = normalized_links

    if body.clear_job:
        candidate.job_id = None
        candidate.stage_id = None
    elif body.job_id is not None:
        job_result = await db.execute(
            select(Job).where(Job.id == body.job_id, Job.org_id == current_user.org_id)
        )
        job = job_result.scalar_one_or_none()
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        if candidate.job_id != body.job_id:
            candidate.job_id = body.job_id
            first_stage_result = await db.execute(
                select(Stage)
                .where(Stage.org_id == current_user.org_id, Stage.job_id == body.job_id)
                .order_by(Stage.position.asc())
                .limit(1)
            )
            first_stage = first_stage_result.scalar_one_or_none()
            candidate.stage_id = first_stage.id if first_stage else None

    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="candidate_updated",
        metadata={"job_id": str(candidate.job_id) if candidate.job_id else None},
    )
    await db.commit()
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
    await db.execute(delete(Email).where(Email.candidate_id == candidate_id))

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
                logger.warning("delete_object failed candidate_id=%s key=%s err=%s", candidate_id, doc.object_key, exc)

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
    if candidate.job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate has no job context for stage move",
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
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stage for candidate job"
        )

    candidate.stage_id = stage.id
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="stage_changed",
        metadata={"stage_id": str(stage.id), "stage_name": stage.name},
    )
    await db.commit()

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

    candidate.status = body.status
    await _log_activity(
        db,
        org_id=current_user.org_id,
        candidate_id=candidate.id,
        created_by_user_id=current_user.id,
        activity_type="status_changed",
        metadata={"status": body.status},
    )
    await db.commit()

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
    candidate_url = _candidate_note_url(candidate.id)
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
