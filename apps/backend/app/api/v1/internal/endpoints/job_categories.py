from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.job import Job
from app.models.job_category import JobCategory
from app.models.user import User
from app.schemas.job_categories import (
    JobCategoryCreateRequest,
    JobCategoryResponse,
    JobCategoryUpdateRequest,
)

router = APIRouter(prefix="/organizations/categories", tags=["job-categories"])


@router.get("", response_model=list[JobCategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:read")),
):
    stmt = (
        select(JobCategory, sa_func.count(Job.id).label("usage_count"))
        .outerjoin(
            Job,
            (Job.org_id == current_user.org_id)
            & ((Job.category_id == JobCategory.id) | (Job.category == JobCategory.name)),
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


@router.patch("/{category_id}", response_model=JobCategoryResponse)
async def update_category(
    category_id: UUID,
    body: JobCategoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("jobs:update")),
):
    stmt = select(JobCategory).where(
        JobCategory.id == category_id, JobCategory.org_id == current_user.org_id
    )
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required"
        )

    async def _usage_for_current_name() -> int:
        count = await db.scalar(
            select(sa_func.count(Job.id)).where(
                Job.org_id == current_user.org_id,
                (Job.category_id == category.id) | (Job.category == category.name),
            )
        )
        return int(count or 0)

    if new_name == category.name:
        return JobCategoryResponse(
            id=str(category.id),
            name=category.name,
            is_system_default=category.is_system_default,
            created_at=category.created_at.isoformat(),
            usage_count=await _usage_for_current_name(),
        )

    dup = await db.execute(
        select(JobCategory).where(
            JobCategory.org_id == current_user.org_id,
            JobCategory.name == new_name,
            JobCategory.id != category.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists"
        )

    old_name = category.name
    category.name = new_name

    await db.execute(
        update(Job)
        .where(Job.org_id == current_user.org_id)
        .where(
            or_(
                Job.category_id == category_id,
                Job.category == old_name,
            )
        )
        .values(category=new_name)
    )

    await db.commit()
    await db.refresh(category)

    return JobCategoryResponse(
        id=str(category.id),
        name=category.name,
        is_system_default=category.is_system_default,
        created_at=category.created_at.isoformat(),
        usage_count=await _usage_for_current_name(),
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
            Job.org_id == current_user.org_id,
            (Job.category_id == category.id) | (Job.category == category.name),
        )
    )
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete category. It is used by {usage_count} job(s)",
        )

    await db.delete(category)
    await db.commit()
