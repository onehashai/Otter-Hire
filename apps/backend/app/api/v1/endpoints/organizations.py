from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.deps.auth import get_current_user, require_active_user
from app.models.job_category import JobCategory
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    CreateOrganizationRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
    SwitchOrganizationRequest,
    UpdateOrganizationRequest,
)
from app.utils.uuid import uuid7

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _set_access_cookie(response: Response, token: str) -> None:
    cookie_params = {
        "key": "access_token",
        "value": token,
        "httponly": True,
        "samesite": "lax",
        "secure": settings.is_production,
    }
    if settings.cookie_domain:
        cookie_params["domain"] = settings.cookie_domain
    response.set_cookie(**cookie_params)


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


@router.get("/memberships", response_model=list[OrganizationMembershipResponse])
async def list_my_memberships(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgMembership, Organization)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == "active",
        )
        .order_by(Organization.name.asc())
    )
    rows = result.all()
    return [
        OrganizationMembershipResponse(
            org_id=membership.org_id,
            org_name=org.name,
            org_website=org.website,
            role=membership.role,
            status=membership.status,
        )
        for membership, org in rows
    ]


@router.post("/switch", response_model=OrganizationMembershipResponse)
async def switch_organization(
    body: SwitchOrganizationRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership_result = await db.execute(
        select(OrgMembership, Organization)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.org_id == body.org_id,
            OrgMembership.status == "active",
        )
    )
    row = membership_result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active membership not found")

    membership, organization = row
    token = create_access_token(
        {
            "user_id": str(current_user.id),
            "org_id": str(membership.org_id),
            "role": membership.role,
        }
    )
    _set_access_cookie(response, token)

    return OrganizationMembershipResponse(
        org_id=membership.org_id,
        org_name=organization.name,
        org_website=organization.website,
        role=membership.role,
        status=membership.status,
    )


@router.post("", response_model=OrganizationMembershipResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: CreateOrganizationRequest,
    response: Response,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    organization = Organization(name=body.name.strip())
    db.add(organization)
    await db.flush()

    for cat_name in ["Engineering", "Design", "Marketing", "Sales", "Data", "Operations", "HR"]:
        db.add(JobCategory(org_id=organization.id, name=cat_name, is_system_default=True))

    membership = OrgMembership(
        id=uuid7(),
        user_id=current_user.id,
        org_id=organization.id,
        role="owner",
        status="active",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(organization)
    await db.refresh(membership)

    token = create_access_token(
        {
            "user_id": str(current_user.id),
            "org_id": str(membership.org_id),
            "role": membership.role,
        }
    )
    _set_access_cookie(response, token)

    return OrganizationMembershipResponse(
        org_id=membership.org_id,
        org_name=organization.name,
        org_website=organization.website,
        role=membership.role,
        status=membership.status,
    )
