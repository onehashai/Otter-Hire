from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy import func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import get_db
from app.deps.job_scope import ASSIGNED_ONLY_ROLES, require_job_access
from app.integrations.linkedin import service as linkedin_service
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.job_team_member import JobTeamMember
from app.models.stage import Stage
from app.models.user import User
from app.schemas.integrations import IntegrationOwnerContext
from app.schemas.jobs import (
    HiringStageResponse,
    JobCreateRequest,
    JobDescriptionAiRequest,
    JobDescriptionAiResponse,
    JobDetailResponse,
    JobListItemResponse,
    JobUpdateRequest,
    JobWorkspaceCandidateResponse,
    JobWorkspaceResponse,
    TeamMemberResponse,
)
from app.services.job_description_ai import run_job_description_ai

router = APIRouter(prefix="/jobs", tags=["jobs"])

DEFAULT_STAGES = [
    ("Applied", 0),
    ("Screening", 1),
    ("Interview", 2),
    ("Offer", 3),
    ("Hired", 4),
    ("Rejected", 5),
]
REQUIRED_STAGE_NAMES = {"Applied", "Hired", "Rejected"}


def _membership_role_for_org(user: User | None, org_id: UUID) -> str | None:
    if user is None:
        return None
    for m in user.memberships:
        if m.org_id == org_id:
            return m.role
    return None


def _default_application_form_schema(job: Job) -> dict:
    profile_links = [
        {
            "id": "profile_link_linkedin",
            "key": "profile_link_linkedin",
            "label": "LinkedIn",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_github",
            "key": "profile_link_github",
            "label": "GitHub",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_portfolio",
            "key": "profile_link_portfolio",
            "label": "Portfolio / Personal Website",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_twitter_x",
            "key": "profile_link_twitter_x",
            "label": "Twitter / X",
            "type": "url",
            "visibility": "hidden",
        },
        {
            "id": "profile_link_dribbble",
            "key": "profile_link_dribbble",
            "label": "Dribbble",
            "type": "url",
            "visibility": "hidden",
        },
        {
            "id": "profile_link_behance",
            "key": "profile_link_behance",
            "label": "Behance",
            "type": "url",
            "visibility": "hidden",
        },
    ]
    return {
        "version": 1,
        "default_fields": {
            "full_name": {"visibility": "required", "label": "Full Name"},
            "email": {"visibility": "required", "label": "Email"},
            "phone": {"visibility": "optional", "label": "Phone Number"},
            "resume": {
                "visibility": "required" if job.collect_resume else "hidden",
                "label": "Resume",
            },
            "cover_letter": {
                "visibility": "optional" if job.collect_cover else "hidden",
                "label": "Cover Letter",
            },
        },
        "profile_links": profile_links,
        "custom_fields": [
            {
                "id": f"screening_{idx}",
                "key": f"screening_{idx}",
                "label": q,
                "type": "short_text",
                "visibility": "optional",
            }
            for idx, q in enumerate((job.screening_questions or []), start=1)
        ],
    }


def _normalized_application_form_schema(job: Job) -> dict:
    schema = dict(job.application_form_schema or _default_application_form_schema(job))
    defaults = _default_application_form_schema(job)
    schema.setdefault("version", 1)
    schema.setdefault("default_fields", defaults["default_fields"])
    schema.setdefault("custom_fields", [])
    schema.setdefault("profile_links", defaults["profile_links"])
    return schema


def _build_detail_response(job: Job) -> JobDetailResponse:
    stages = sorted(job.stages, key=lambda s: s.position)
    hiring_stages = [
        HiringStageResponse(id=s.id, name=s.name, position=s.position, is_required=s.is_required)
        for s in stages
    ]
    team = []
    for tm in job.team_members:
        user = tm.user
        team.append(
            TeamMemberResponse(
                id=tm.id,
                user_id=tm.user_id,
                name=user.name if user else None,
                email=user.email if user else None,
                role=tm.role,
                user_role=_membership_role_for_org(user, job.org_id),
            )
        )
    return JobDetailResponse(
        id=job.id,
        title=job.title,
        category=job.category,
        employment_type=job.employment_type,
        workplace_type=job.workplace_type,
        country=job.country,
        city=job.city,
        openings=job.openings,
        salary_type=job.salary_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        salary_fixed=job.salary_fixed,
        currency=job.currency,
        salary_timeframe=job.salary_timeframe,
        post_to_linkedin=bool(job.post_to_linkedin),
        linkedin_sync_status=job.linkedin_sync_status,
        linkedin_external_job_id=job.linkedin_external_job_id,
        linkedin_last_synced_at=job.linkedin_last_synced_at,
        linkedin_last_error=job.linkedin_last_error,
        description=job.description,
        status=job.status,
        visibility=job.visibility,
        collect_resume=job.collect_resume,
        collect_cover=job.collect_cover,
        screening_questions=job.screening_questions or [],
        application_form_schema=_normalized_application_form_schema(job),
        hiring_stages=hiring_stages,
        team_members=team,
        created_by_user_id=job.created_by_user_id,
        published_at=job.published_at,
        closed_at=job.closed_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _normalize_location_fields_for_update(job: Job, update_data: dict) -> None:
    """Clear country/city when remote; normalize empty strings to None."""
    for key in ("country", "city"):
        if key in update_data and update_data[key] == "":
            update_data[key] = None

    wp = update_data.get("workplace_type", job.workplace_type)
    if wp == "remote":
        update_data["country"] = None
        update_data["city"] = None


def _require_country_city_for_hybrid_onsite(
    workplace_type: str | None,
    country: str | None,
    city: str | None,
) -> None:
    if workplace_type not in ("hybrid", "onsite"):
        return
    if not country or not str(country).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Country and city are required for hybrid and onsite jobs.",
        )
    if not city or not str(city).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Country and city are required for hybrid and onsite jobs.",
        )


async def _get_job_or_404(
    db: AsyncSession, job_id: UUID, org_id: UUID, *, load_relations: bool = True
) -> Job:
    stmt = select(Job).where(Job.id == job_id, Job.org_id == org_id)
    if load_relations:
        stmt = stmt.options(
            selectinload(Job.stages),
            selectinload(Job.team_members)
            .selectinload(JobTeamMember.user)
            .selectinload(User.memberships),
        )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("", status_code=status.HTTP_201_CREATED, response_model=JobDetailResponse)
async def create_job(
    body: JobCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:create")),
):
    job = Job(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        title=body.title,
        category="Software Development",
        workplace_type="remote",
        collect_resume=True,
        collect_cover=False,
        status="draft",
    )
    job.application_form_schema = _default_application_form_schema(job)
    db.add(job)
    await db.flush()

    # Add default hiring stages
    for name, position in DEFAULT_STAGES:
        stage = Stage(
            org_id=current_user.org_id,
            job_id=job.id,
            name=name,
            position=position,
            is_required=name in REQUIRED_STAGE_NAMES,
        )
        db.add(stage)

    # Add job creator as recruiter by default
    creator_team_member = JobTeamMember(
        org_id=current_user.org_id,
        job_id=job.id,
        user_id=current_user.id,
        role="recruiter",
    )
    db.add(creator_team_member)

    await db.commit()

    return _build_detail_response(await _get_job_or_404(db, job.id, current_user.org_id))


@router.patch("/{job_id}", response_model=JobDetailResponse)
async def update_job(
    job_id: UUID,
    body: JobUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:update")),
):
    job = await _get_job_or_404(db, job_id, current_user.org_id)

    hiring_stages_input = body.hiring_stages
    team_members_input = body.team_members

    update_data = body.model_dump(exclude_unset=True, exclude={"hiring_stages", "team_members"})
    _normalize_location_fields_for_update(job, update_data)

    effective_wp = update_data.get("workplace_type", job.workplace_type)
    effective_country = update_data["country"] if "country" in update_data else job.country
    effective_city = update_data["city"] if "city" in update_data else job.city
    _require_country_city_for_hybrid_onsite(effective_wp, effective_country, effective_city)

    for field, value in update_data.items():
        setattr(job, field, value)

    relations_changed = False

    if hiring_stages_input is not None:
        if len(hiring_stages_input) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pipeline must have at least 3 stages",
            )

        required_stages = {s.id: s.name for s in job.stages if s.is_required}
        provided_stage_ids = {s.id for s in hiring_stages_input if s.id is not None}

        if provided_stage_ids:
            missing_required = [
                name for sid, name in required_stages.items() if sid not in provided_stage_ids
            ]
            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required stages cannot be deleted: {', '.join(missing_required)}",
                )
        elif required_stages:
            provided_stage_names = {
                s.name.strip().lower() for s in hiring_stages_input if s.name.strip()
            }
            missing_required = [
                name
                for name in required_stages.values()
                if name.lower() not in provided_stage_names
            ]
            if missing_required:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required stages cannot be deleted: {', '.join(missing_required)}",
                )

        for stage_data in hiring_stages_input:
            stage_name = stage_data.name.strip()
            if not stage_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Stage name cannot be empty",
                )

            if stage_data.id in required_stages and stage_name != required_stages[stage_data.id]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required stage '{required_stages[stage_data.id]}' cannot be renamed",
                )

        stage_names_in_order = [s.name.strip() for s in hiring_stages_input if s.name.strip()]
        if (
            not stage_names_in_order
            or stage_names_in_order[0].lower() != "applied"
            or len(stage_names_in_order) < 3
            or stage_names_in_order[-2].lower() != "hired"
            or stage_names_in_order[-1].lower() != "rejected"
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stage order must be Applied first, Hired second last, Rejected last",
            )

        await db.execute(delete(Stage).where(Stage.job_id == job.id))
        for i, stage_data in enumerate(hiring_stages_input):
            stage_name = stage_data.name.strip()
            stage = Stage(
                org_id=current_user.org_id,
                job_id=job.id,
                name=stage_name,
                position=i,
                is_required=(stage_data.id in required_stages)
                or (stage_name.lower() in {n.lower() for n in REQUIRED_STAGE_NAMES}),
            )
            db.add(stage)
        relations_changed = True

    if team_members_input is not None:
        await db.execute(delete(JobTeamMember).where(JobTeamMember.job_id == job.id))
        for tm_data in team_members_input:
            tm = JobTeamMember(
                org_id=current_user.org_id,
                job_id=job.id,
                user_id=tm_data.user_id,
                role=tm_data.role,
            )
            db.add(tm)
        relations_changed = True

    if relations_changed and not update_data:
        job.updated_at = datetime.now(timezone.utc)

    job_id_val = job.id
    org_id_val = current_user.org_id

    await db.commit()

    db.expunge_all()

    return _build_detail_response(await _get_job_or_404(db, job_id_val, org_id_val))


@router.get("", response_model=list[JobListItemResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    candidate_count_sub = (
        select(
            Candidate.job_id,
            sa_func.count(Candidate.id).label("cnt"),
        )
        .where(
            Candidate.org_id == current_user.org_id,
            Candidate.status == "active",
        )
        .group_by(Candidate.job_id)
        .subquery()
    )

    stmt = (
        select(Job, sa_func.coalesce(candidate_count_sub.c.cnt, 0).label("candidate_count"))
        .outerjoin(candidate_count_sub, Job.id == candidate_count_sub.c.job_id)
        .where(Job.org_id == current_user.org_id)
        .order_by(Job.updated_at.desc())
    )

    if current_user.membership_role in ASSIGNED_ONLY_ROLES:
        stmt = stmt.join(
            JobTeamMember,
            (JobTeamMember.job_id == Job.id) & (JobTeamMember.user_id == current_user.id),
        ).distinct(Job.id)

    result = await db.execute(stmt)
    items = []
    for row in result.all():
        job = row[0]
        count = row[1]
        items.append(
            JobListItemResponse(
                id=job.id,
                title=job.title,
                category=job.category,
                employment_type=job.employment_type,
                status=job.status,
                candidate_count=count,
                created_at=job.created_at,
                updated_at=job.updated_at,
            )
        )
    return items


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    job = await require_job_access(job_id, db, current_user)
    return _build_detail_response(job)


@router.get("/{job_id}/workspace", response_model=JobWorkspaceResponse)
async def get_job_workspace(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    job = await require_job_access(job_id, db, current_user)
    stages = sorted(job.stages, key=lambda s: s.position)
    fallback_stage_id = stages[0].id if stages else None

    candidate_result = await db.execute(
        select(Candidate)
        .where(
            Candidate.org_id == current_user.org_id,
            Candidate.job_id == job.id,
            Candidate.status == "active",
        )
        .order_by(Candidate.updated_at.desc(), Candidate.created_at.desc())
    )
    candidates = candidate_result.scalars().all()

    return JobWorkspaceResponse(
        id=job.id,
        title=job.title,
        status=job.status,
        stages=[
            HiringStageResponse(
                id=stage.id,
                name=stage.name,
                position=stage.position,
                is_required=stage.is_required,
            )
            for stage in stages
        ],
        candidates=[
            JobWorkspaceCandidateResponse(
                id=candidate.id,
                name=candidate.name,
                email=candidate.email,
                stage_id=candidate.stage_id or fallback_stage_id,
                created_at=candidate.created_at,
                updated_at=candidate.updated_at,
            )
            for candidate in candidates
        ],
    )


@router.post("/{job_id}/ai-description", response_model=JobDescriptionAiResponse)
async def ai_job_description(
    job_id: UUID,
    body: JobDescriptionAiRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:update")),
):
    """Generate or transform job description HTML using OpenAI (server-side key)."""
    job = await require_job_access(job_id, db, current_user)
    if not (settings.openai_api_key or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assist is not configured (missing OPENAI_API_KEY).",
        )
    try:
        html = await run_job_description_ai(
            action=body.action,
            current_html=body.current_html,
            title=job.title,
            category=job.category,
            employment_type=job.employment_type,
            workplace_type=job.workplace_type,
            country=job.country,
            city=job.city,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        ) from e
    return JobDescriptionAiResponse(html=html)


@router.post("/{job_id}/publish", response_model=JobDetailResponse)
async def publish_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:publish")),
):
    job = await _get_job_or_404(db, job_id, current_user.org_id)

    if job.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot publish a job with status '{job.status}'. "
                "Only draft jobs can be published."
            ),
        )

    if not job.title or not job.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job title is required to publish.",
        )

    stages = sorted(job.stages, key=lambda s: s.position)
    if len(stages) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 hiring stages are required to publish.",
        )

    _require_country_city_for_hybrid_onsite(job.workplace_type, job.country, job.city)

    if job.salary_type == "fixed" and job.salary_fixed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fixed salary amount is required when salary type is 'fixed'.",
        )

    if job.salary_type == "range":
        if job.salary_min is None or job.salary_max is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Salary min and max are required when salary type is 'range'.",
            )
        if job.salary_min > job.salary_max:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Salary minimum must be less than or equal to maximum.",
            )

    if job.post_to_linkedin:
        if not settings.feature_linkedin_distribution:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LinkedIn distribution feature is disabled.",
            )
        linkedin_status = await linkedin_service.get_linkedin_status(
            db,
            IntegrationOwnerContext(
                org_id=str(current_user.org_id),
                user_id=str(current_user.id),
                role=current_user.membership_role,
            ),
        )
        if not linkedin_status.get("connected") or not linkedin_status.get("setup_complete"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LinkedIn distribution is enabled but integration setup is incomplete.",
            )

    job.status = "open"
    job.visibility = "public"
    job.published_at = datetime.now(timezone.utc)
    if job.post_to_linkedin:
        await linkedin_service.sync_job_distribution_to_linkedin(db, job)
    await db.commit()

    return _build_detail_response(await _get_job_or_404(db, job.id, current_user.org_id))


@router.post("/{job_id}/archive", response_model=JobDetailResponse)
async def archive_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:close")),
):
    job = await _get_job_or_404(db, job_id, current_user.org_id)

    if job.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job is already archived.",
        )

    job.status = "archived"
    job.visibility = "internal"
    job.closed_at = datetime.now(timezone.utc)
    await db.commit()

    return _build_detail_response(await _get_job_or_404(db, job.id, current_user.org_id))


@router.post("/{job_id}/unpublish", response_model=JobDetailResponse)
async def unpublish_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:unpublish")),
):
    job = await _get_job_or_404(db, job_id, current_user.org_id)

    if job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot unpublish a job with status '{job.status}'. "
                "Only open jobs can be unpublished."
            ),
        )

    job.status = "draft"
    job.visibility = "internal"
    job.published_at = None
    await db.commit()

    return _build_detail_response(await _get_job_or_404(db, job.id, current_user.org_id))
