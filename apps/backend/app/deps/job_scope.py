from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Job
from app.models.job_team_member import JobTeamMember
from app.models.user import User

ASSIGNED_ONLY_ROLES = {"hiring_manager", "interviewer"}


async def require_job_access(
    job_id: UUID,
    db: AsyncSession,
    current_user: User,
    *,
    load_relations: bool = True,
) -> Job:
    stmt = select(Job).where(Job.id == job_id, Job.org_id == current_user.org_id)
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if current_user.membership_role in ASSIGNED_ONLY_ROLES:
        assigned = await db.execute(
            select(
                exists().where(
                    JobTeamMember.job_id == job.id,
                    JobTeamMember.user_id == current_user.id,
                )
            )
        )
        if not assigned.scalar():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Job access denied",
            )

    return job
