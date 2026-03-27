from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_access_token
from app.db.session import get_db
from app.models.org_membership import OrgMembership
from app.models.user import User


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_NOT_AUTHENTICATED", "message": "Authentication required."},
        )

    try:
        payload = verify_access_token(access_token)
        user_id = UUID(str(payload.get("user_id")))
        org_id = UUID(str(payload.get("org_id")))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_INVALID_TOKEN", "message": "Invalid or expired session."},
        ) from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_USER_NOT_FOUND", "message": "User account not found."},
        )

    membership_result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_MEMBERSHIP_NOT_FOUND", "message": "Membership not found."},
        )

    # Compatibility shim: existing handlers expect org-scoped attrs on current_user.
    user.org_id = membership.org_id
    user.membership_role = membership.role
    user.status = membership.status

    return user


async def require_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Require user to be verified and onboarded."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_EMAIL_VERIFICATION_REQUIRED",
                "message": "Email verification required.",
            },
        )

    if not current_user.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "AUTH_ONBOARDING_REQUIRED", "message": "Onboarding required."},
        )

    return current_user
