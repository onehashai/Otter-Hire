from uuid import UUID

import sentry_sdk
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
    # Use object.__setattr__ to bypass SQLAlchemy's instrumentation so these
    # in-memory overrides are never flushed to the DB as dirty column changes.
    object.__setattr__(user, "org_id", membership.org_id)
    object.__setattr__(user, "membership_role", membership.role)
    object.__setattr__(user, "status", membership.status)

    # Attach non-PII user context to Sentry so every event on this request
    # carries the internal user ID, org, and role for triage.
    # Deliberately omit email/name — only internal UUIDs and the role segment.
    sentry_sdk.set_user({"id": str(user.id), "segment": membership.role})
    sentry_sdk.set_tag("org_id", str(membership.org_id))

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
