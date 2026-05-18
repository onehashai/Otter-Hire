from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.email import InboundEmail
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.admin import (
    ALLOWED_ORG_ROLES_FOR_ADMIN_UPDATE,
    AdminOrganizationRow,
    AdminUpdateMembershipRequest,
    AdminUserMembershipRow,
)
from app.schemas.email_logs import AdminEmailLogRow

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_platform_admin(
    current_user: User = Depends(require_active_user),
) -> User:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required",
        )
    return current_user


@router.get("/users", response_model=list[AdminUserMembershipRow])
async def list_all_user_memberships(
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, OrgMembership, Organization)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .join(Organization, Organization.id == OrgMembership.org_id)
        .order_by(Organization.name.asc(), User.email.asc())
    )
    rows = result.all()
    return [
        AdminUserMembershipRow(
            membership_id=membership.id,
            user_id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            product_role=user.role,
            organization_role=membership.role,
            org_id=organization.id,
            org_name=organization.name,
            status=membership.status,
            last_active_at=user.updated_at,
        )
        for user, membership, organization in rows
    ]


@router.patch("/memberships/{membership_id}", response_model=AdminUserMembershipRow)
async def update_membership(
    membership_id: UUID,
    body: AdminUpdateMembershipRequest,
    current_user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update user identity, platform role, and/or this org membership (not organization transfer)."""
    result = await db.execute(
        select(User, OrgMembership, Organization)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .join(Organization, Organization.id == OrgMembership.org_id)
        .where(OrgMembership.id == membership_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    user, membership, organization = row

    if body.name is not None:
        user.name = body.name

    if body.email is not None and body.email != user.email:
        dup = await db.execute(select(User.id).where(User.email == body.email, User.id != user.id))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )
        user.email = body.email

    if body.product_role is not None and body.product_role != user.role:
        if body.product_role == "user" and user.role == "admin":
            admin_count = (
                await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))
            ).scalar_one()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last platform administrator",
                )
        user.role = body.product_role

    if body.organization_role is not None and body.organization_role != membership.role:
        if membership.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change organization role for an owner",
            )
        if body.organization_role not in ALLOWED_ORG_ROLES_FOR_ADMIN_UPDATE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid organization role",
            )
        membership.role = body.organization_role

    if body.status is not None and body.status != membership.status:
        if membership.role == "owner" and body.status == "declined":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot disable an organization owner",
            )
        membership.status = body.status

    await db.commit()
    await db.refresh(user)
    await db.refresh(membership)

    return AdminUserMembershipRow(
        membership_id=membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        product_role=user.role,
        organization_role=membership.role,
        org_id=organization.id,
        org_name=organization.name,
        status=membership.status,
        last_active_at=user.updated_at,
    )


@router.get("/organizations", response_model=list[AdminOrganizationRow])
async def list_all_organizations(
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    member_counts = (
        select(
            OrgMembership.org_id.label("org_id"),
            func.count(OrgMembership.id).label("cnt"),
        )
        .where(OrgMembership.status.in_(("active", "pending")))
        .group_by(OrgMembership.org_id)
    ).subquery()

    result = await db.execute(
        select(Organization, func.coalesce(member_counts.c.cnt, 0).label("member_count"))
        .outerjoin(member_counts, member_counts.c.org_id == Organization.id)
        .order_by(Organization.name.asc())
    )
    rows = result.all()
    return [
        AdminOrganizationRow(
            id=org.id,
            name=org.name,
            website=org.website,
            member_count=int(cnt or 0),
            created_at=org.created_at,
        )
        for org, cnt in rows
    ]


@router.get("/email-logs", response_model=list[AdminEmailLogRow])
async def list_admin_email_logs(
    org_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sender: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    q = (
        select(InboundEmail, Organization.name.label("org_name"))
        .join(Organization, Organization.id == InboundEmail.org_id)
        .where(InboundEmail.received_at >= cutoff)
        .order_by(InboundEmail.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if org_id:
        q = q.where(InboundEmail.org_id == org_id)
    if status_filter:
        q = q.where(InboundEmail.parse_status == status_filter)
    if sender:
        q = q.where(InboundEmail.from_email.ilike(f"%{sender}%"))
    if date_from:
        q = q.where(InboundEmail.received_at >= date_from)
    if date_to:
        q = q.where(InboundEmail.received_at <= date_to)

    rows = (await db.execute(q)).all()
    return [
        AdminEmailLogRow(
            id=r.InboundEmail.id,
            received_at=r.InboundEmail.received_at,
            from_email=r.InboundEmail.from_email,
            from_name=r.InboundEmail.from_name,
            subject=r.InboundEmail.subject,
            parse_status=r.InboundEmail.parse_status,
            parse_error=r.InboundEmail.parse_error,
            has_resume_attachment=r.InboundEmail.has_resume_attachment,
            attachment_count=r.InboundEmail.attachment_count,
            attachment_primary_filename=r.InboundEmail.attachment_primary_filename,
            parsed_candidate_id=r.InboundEmail.parsed_candidate_id,
            parse_duration_ms=r.InboundEmail.parse_duration_ms,
            inbox_address=r.InboundEmail.inbox_address,
            created_at=r.InboundEmail.created_at,
            org_id=r.InboundEmail.org_id,
            org_name=r.org_name,
        )
        for r in rows
    ]
