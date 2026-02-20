from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import OrganizationResponse, UpdateOrganizationRequest

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.patch("/me", response_model=OrganizationResponse)
async def update_my_organization(
    body: UpdateOrganizationRequest,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    organization = result.scalar_one()

    organization.name = body.name
    organization.website = body.website

    await db.commit()
    await db.refresh(organization)

    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
    )
