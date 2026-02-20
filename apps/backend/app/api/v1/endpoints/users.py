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
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/invite", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    body: InviteUserRequest,
    current_user: User = Depends(require_permission("users:invite")),
    db: AsyncSession = Depends(get_db),
):
    existing_result = await db.execute(
        select(User).where(
            User.org_id == current_user.org_id,
            User.email == body.email,
        )
    )
    existing_user = existing_result.scalar_one_or_none()

    if existing_user is not None:
        if existing_user.status == "invited":
            raw_token = secrets.token_urlsafe(32)
            token_hash = sha256(raw_token.encode()).hexdigest()
            token_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.invite_token_expire_days)

            existing_user.invite_token_hash = token_hash
            existing_user.invite_token_expires_at = token_expires_at
            if body.name:
                existing_user.name = body.name
            await db.commit()
            await db.refresh(existing_user)

            org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
            org = org_result.scalar_one()

            invite_url = f"{settings.frontend_base_url}/accept-invite?token={raw_token}"
            await send_invite_email(
                to_email=existing_user.email,
                invite_url=invite_url,
                org_name=org.name,
                inviter_name=current_user.name,
            )

            return UserResponse.model_validate(existing_user)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists in the organization",
        )

    raw_token = secrets.token_urlsafe(32)
    token_hash = sha256(raw_token.encode()).hexdigest()
    token_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.invite_token_expire_days)

    new_user = User(
        org_id=current_user.org_id,
        email=body.email,
        name=body.name or body.email.split("@")[0],
        hashed_password="",
        role="employee",
        status="invited",
        is_verified=False,
        is_onboarded=False,
        invite_token_hash=token_hash,
        invite_token_expires_at=token_expires_at,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    org = org_result.scalar_one()

    invite_url = f"{settings.frontend_base_url}/accept-invite?token={raw_token}"
    await send_invite_email(
        to_email=new_user.email,
        invite_url=invite_url,
        org_name=org.name,
        inviter_name=current_user.name,
    )

    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    body: UpdateUserRoleRequest,
    current_user: User = Depends(require_permission("users:update_role")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.org_id == current_user.org_id,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify the owner",
        )

    target.role = body.role.value
    await db.commit()
    await db.refresh(target)

    return UserResponse.model_validate(target)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_permission("users:remove")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.org_id == current_user.org_id,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete the owner",
        )

    await db.delete(target)
    await db.commit()
