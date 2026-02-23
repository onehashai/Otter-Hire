from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.permissions import require_permission
from app.deps.job_scope import require_job_access, ASSIGNED_ONLY_ROLES
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.job_team_member import JobTeamMember
from app.models.stage import Stage
from app.models.user import User
from app.schemas.jobs import (
    JobCreateRequest,
    JobUpdateRequest,
    JobListItemResponse,
    JobDetailResponse,
    HiringStageResponse,
    TeamMemberResponse,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

DEFAULT_STAGES = [
    ("Applied", 0),
    ("Screening", 1),
    ("Interview", 2),
    ("Offer", 3),
    ("Hired", 4),
]


def _build_detail_response(job: Job) -> JobDetailResponse:
    stages = sorted(job.stages, key=lambda s: s.position)
    hiring_stages = [
        HiringStageResponse(id=s.id, name=s.name, position=s.position) for s in stages
    ]
    team = []
    for tm in job.team_members:
        user = tm.user
        team.append(TeamMemberResponse(
            id=tm.id,
            user_id=tm.user_id,
            name=user.name if user else None,
            email=user.email if user else None,
            role=tm.role,
        ))
    return JobDetailResponse(
        id=job.id,
        title=job.title,
        department=job.department,
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
        description=job.description,
        status=job.status,
        visibility=job.visibility,
        collect_resume=job.collect_resume,
        collect_cover=job.collect_cover,
        screening_questions=job.screening_questions or [],
        pipeline_template=job.pipeline_template,
        hiring_stages=hiring_stages,
        team_members=team,
        created_by_user_id=job.created_by_user_id,
        published_at=job.published_at,
        closed_at=job.closed_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


async def _get_job_or_404(
    db: AsyncSession, job_id: UUID, org_id: UUID, *, load_relations: bool = True
) -> Job:
    stmt = select(Job).where(Job.id == job_id, Job.org_id == org_id)
    if load_relations:
        stmt = stmt.options(
            selectinload(Job.stages),
            selectinload(Job.team_members).selectinload(JobTeamMember.user),
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
        department="engineering",
        status="draft",
    )
    db.add(job)
    await db.flush()

    # Add default hiring stages
    for name, position in DEFAULT_STAGES:
        stage = Stage(
            org_id=current_user.org_id,
            job_id=job.id,
            name=name,
            position=position,
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

    return _build_detail_response(
        await _get_job_or_404(db, job.id, current_user.org_id)
    )


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

    for field, value in update_data.items():
        setattr(job, field, value)

    relations_changed = False

    if hiring_stages_input is not None:
        if len(hiring_stages_input) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pipeline must have at least 2 stages",
            )
        await db.execute(delete(Stage).where(Stage.job_id == job.id))
        for i, stage_data in enumerate(hiring_stages_input):
            stage = Stage(
                org_id=current_user.org_id,
                job_id=job.id,
                name=stage_data.name,
                position=stage_data.position if stage_data.position is not None else i,
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

    return _build_detail_response(
        await _get_job_or_404(db, job_id_val, org_id_val)
    )


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
        .where(Candidate.org_id == current_user.org_id)
        .group_by(Candidate.job_id)
        .subquery()
    )

    stmt = (
        select(Job, sa_func.coalesce(candidate_count_sub.c.cnt, 0).label("candidate_count"))
        .outerjoin(candidate_count_sub, Job.id == candidate_count_sub.c.job_id)
        .where(Job.org_id == current_user.org_id)
        .order_by(Job.updated_at.desc())
    )

    if current_user.role in ASSIGNED_ONLY_ROLES:
        stmt = (
            stmt.join(
                JobTeamMember,
                (JobTeamMember.job_id == Job.id) & (JobTeamMember.user_id == current_user.id),
            )
            .distinct(Job.id)
        )

    result = await db.execute(stmt)
    items = []
    for row in result.all():
        job = row[0]
        count = row[1]
        items.append(JobListItemResponse(
            id=job.id,
            title=job.title,
            department=job.department,
            employment_type=job.employment_type,
            status=job.status,
            candidate_count=count,
            created_at=job.created_at,
            updated_at=job.updated_at,
        ))
    return items


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    job = await require_job_access(job_id, db, current_user)
    return _build_detail_response(job)


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
            detail=f"Cannot publish a job with status '{job.status}'. Only draft jobs can be published.",
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

    job.status = "open"
    job.visibility = "public"
    job.published_at = datetime.now(timezone.utc)
    await db.commit()

    return _build_detail_response(
        await _get_job_or_404(db, job.id, current_user.org_id)
    )


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

    return _build_detail_response(
        await _get_job_or_404(db, job.id, current_user.org_id)
    )


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
            detail=f"Cannot unpublish a job with status '{job.status}'. Only open jobs can be unpublished.",
        )

    job.status = "draft"
    job.visibility = "internal"
    job.published_at = None
    await db.commit()

    return _build_detail_response(
        await _get_job_or_404(db, job.id, current_user.org_id)
    )
