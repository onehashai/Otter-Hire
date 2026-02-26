from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.job import Job
from app.models.job_category import JobCategory
from app.models.user import User
from app.schemas.job_categories import JobCategoryCreateRequest, JobCategoryResponse

router = APIRouter(prefix="/organizations/categories", tags=["job-categories"])

SYSTEM_DEFAULTS = ["Engineering", "Design", "Marketing", "Sales", "Data", "Operations", "HR"]


@router.get("", response_model=list[JobCategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    stmt = (
        select(JobCategory, sa_func.count(Job.id).label("usage_count"))
        .outerjoin(
            Job,
            (Job.org_id == current_user.org_id) & (Job.category == JobCategory.name),
        )
        .where(JobCategory.org_id == current_user.org_id)
        .group_by(JobCategory.id)
        .order_by(JobCategory.is_system_default.desc(), JobCategory.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        JobCategoryResponse(
            id=str(c.id),
            name=c.name,
            is_system_default=c.is_system_default,
            created_at=c.created_at.isoformat(),
            usage_count=int(usage_count or 0),
        )
        for c, usage_count in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=JobCategoryResponse)
async def create_category(
    body: JobCategoryCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:create")),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required"
        )

    existing = await db.execute(
        select(JobCategory).where(
            JobCategory.org_id == current_user.org_id, JobCategory.name == name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists"
        )

    category = JobCategory(org_id=current_user.org_id, name=name, is_system_default=False)
    db.add(category)
    await db.commit()
    await db.refresh(category)

    return JobCategoryResponse(
        id=str(category.id),
        name=category.name,
        is_system_default=category.is_system_default,
        created_at=category.created_at.isoformat(),
        usage_count=0,
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:delete")),
):
    stmt = select(JobCategory).where(
        JobCategory.id == category_id, JobCategory.org_id == current_user.org_id
    )
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    usage_count = await db.scalar(
        select(sa_func.count(Job.id)).where(
            Job.org_id == current_user.org_id, Job.category == category.name
        )
    )
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete category. It is used by {usage_count} job(s)",
        )

    await db.delete(category)
    await db.commit()
