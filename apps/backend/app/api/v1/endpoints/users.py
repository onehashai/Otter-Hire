import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.users import InviteUserRequest, UpdateUserRoleRequest, UserResponse
from app.services.email import send_invite_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, OrgMembership)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .where(OrgMembership.org_id == current_user.org_id)
        .order_by(OrgMembership.created_at.asc())
    )
    rows = result.all()
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=membership.role,
            status=membership.status,
        )
        for user, membership in rows
    ]


@router.post("/invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    body: InviteUserRequest,
    current_user: User = Depends(require_permission("users:invite")),
    db: AsyncSession = Depends(get_db),
):
    existing_user_result = await db.execute(select(User).where(User.email == body.email))
    existing_user = existing_user_result.scalar_one_or_none()

    existing_membership = None
    if existing_user is not None:
        existing_membership_result = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == existing_user.id,
                OrgMembership.org_id == current_user.org_id,
            )
        )
        existing_membership = existing_membership_result.scalar_one_or_none()

    if existing_membership is not None:
        if existing_membership.status == "invited":
            raw_token = secrets.token_urlsafe(32)
            token_hash = sha256(raw_token.encode()).hexdigest()
            token_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.invite_token_expire_days)

            existing_membership.invite_token_hash = token_hash
            existing_membership.invite_token_expires_at = token_expires_at
            existing_membership.role = body.role.value
            if body.name:
                existing_user.name = body.name
            await db.commit()
            await db.refresh(existing_user)
            await db.refresh(existing_membership)

            org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
            org = org_result.scalar_one()

            invite_url = f"{settings.frontend_base_url}/invite/{raw_token}"
            await send_invite_email(
                to_email=existing_user.email,
                invite_url=invite_url,
                org_name=org.name,
                inviter_name=current_user.name,
            )

            return UserResponse(
                id=existing_user.id,
                email=existing_user.email,
                name=existing_user.name,
                role=existing_membership.role,
                status=existing_membership.status,
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists in the organization",
        )

    raw_token = secrets.token_urlsafe(32)
    token_hash = sha256(raw_token.encode()).hexdigest()
    token_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.invite_token_expire_days)

    new_user = existing_user or User(
        org_id=current_user.org_id,
        email=body.email,
        name=body.name or body.email.split("@")[0],
        hashed_password="",
        role=body.role.value,
        status="invited",
        is_verified=False,
        is_onboarded=False,
    )
    if existing_user is None:
        db.add(new_user)
        await db.flush()

    membership = OrgMembership(
        user_id=new_user.id,
        org_id=current_user.org_id,
        role=body.role.value,
        status="invited",
        invite_token_hash=token_hash,
        invite_token_expires_at=token_expires_at,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_user)
    await db.refresh(membership)

    org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_result.scalar_one()

    invite_url = f"{settings.frontend_base_url}/invite/{raw_token}"
    await send_invite_email(
        to_email=new_user.email,
        invite_url=invite_url,
        org_name=org.name,
        inviter_name=current_user.name,
    )

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        role=membership.role,
        status=membership.status,
    )


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    body: UpdateUserRoleRequest,
    current_user: User = Depends(require_permission("users:update_role")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, OrgMembership)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .where(
            User.id == user_id,
            OrgMembership.org_id == current_user.org_id,
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target, membership = row

    if membership.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify the owner",
        )

    membership.role = body.role.value
    await db.commit()
    await db.refresh(target)
    await db.refresh(membership)

    return UserResponse(
        id=target.id,
        email=target.email,
        name=target.name,
        role=membership.role,
        status=membership.status,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_permission("users:remove")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, OrgMembership)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .where(
            User.id == user_id,
            OrgMembership.org_id == current_user.org_id,
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target, membership = row

    if membership.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete the owner",
        )

    await db.delete(membership)
    await db.commit()
