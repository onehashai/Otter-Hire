import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    AuthUserResponse,
    LoginRequest,
    OnboardingRequest,
    ResendVerificationRequest,
    SignupRequest,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.services.email import send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _to_user_response(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        org_id=user.org_id,
        is_verified=user.is_verified,
        is_onboarded=user.is_onboarded,
    )


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )


@router.post("/signup", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/15 minutes")
async def signup(request: Request, payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AuthUserResponse:
    normalized_email = payload.email.lower()

    existing_user = await db.execute(select(User).where(User.email == normalized_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    org_name = f"{(payload.name or normalized_email).split('@')[0]} Organization"
    organization = Organization(id=uuid4(), name=org_name)
    db.add(organization)
    await db.flush()

    raw_token = secrets.token_urlsafe(32)
    token_hash = sha256(raw_token.encode()).hexdigest()
    token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    user = User(
        id=uuid4(),
        org_id=organization.id,
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        name=payload.name or normalized_email.split("@")[0],
        role="admin",
        status="active",
        is_verified=False,
        verification_token_hash=token_hash,
        verification_token_expires_at=token_expires_at,
        is_onboarded=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    verify_url = f"{settings.frontend_base_url}/verify?token={raw_token}"
    await send_verification_email(user.email, verify_url)

    token = create_access_token(
        {
            "user_id": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role,
        }
    )
    _set_access_cookie(response, token)
    return _to_user_response(user)


@router.post("/login", response_model=AuthUserResponse)
@limiter.limit("5/15 minutes")
async def login(request: Request, payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AuthUserResponse:
    normalized_email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        {
            "user_id": str(user.id),
            "org_id": str(user.org_id),
            "role": user.role,
        }
    )
    _set_access_cookie(response, token)
    return _to_user_response(user)


@router.get("/me", response_model=AuthUserResponse)
async def me(current_user: User = Depends(get_current_user)) -> AuthUserResponse:
    return _to_user_response(current_user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(key="access_token")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/verify", response_model=VerifyEmailResponse)
@limiter.limit("10/15 minutes")
async def verify_email(request: Request, payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> VerifyEmailResponse:
    token_hash = sha256(payload.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(User).where(
            User.verification_token_hash == token_hash,
            User.verification_token_expires_at > now,
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")

    user.is_verified = True
    user.verified_at = now
    user.verification_token_hash = None
    user.verification_token_expires_at = None
    await db.commit()

    return VerifyEmailResponse(ok=True)


@router.post("/resend-verification", response_model=VerifyEmailResponse)
@limiter.limit("5/15 minutes")
async def resend_verification(
    request: Request, payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
) -> VerifyEmailResponse:
    normalized_email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if user and not user.is_verified:
        raw_token = secrets.token_urlsafe(32)
        token_hash = sha256(raw_token.encode()).hexdigest()
        token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        user.verification_token_hash = token_hash
        user.verification_token_expires_at = token_expires_at
        await db.commit()

        verify_url = f"{settings.frontend_base_url}/verify?token={raw_token}"
        await send_verification_email(user.email, verify_url)

    return VerifyEmailResponse(ok=True)


@router.post("/onboarding", response_model=AuthUserResponse)
async def onboarding(
    payload: OnboardingRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthUserResponse:
    if not current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")

    if current_user.is_onboarded:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already onboarded")

    current_user.name = payload.full_name
    current_user.is_onboarded = True

    org_result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = org_result.scalar_one()
    organization.name = payload.organization_name

    await db.commit()
    await db.refresh(current_user)

    token = create_access_token(
        {
            "user_id": str(current_user.id),
            "org_id": str(current_user.org_id),
            "role": current_user.role,
        }
    )
    _set_access_cookie(response, token)
    return _to_user_response(current_user)


# MANUAL TESTING CHECKLIST:
# - [ ] POST /auth/signup sends verification email (check logs or inbox)
# - [ ] POST /auth/verify with valid token marks user as verified
# - [ ] POST /auth/verify with invalid/expired token returns 400
# - [ ] POST /auth/resend-verification sends new email
# - [ ] GET /auth/me includes is_verified and is_onboarded fields
# - [ ] POST /auth/login still works (unchanged)
# - [ ] POST /auth/logout still works (unchanged)
# PHASE 2:
# - [ ] Verified user can call POST /auth/onboarding
# - [ ] JWT is regenerated after onboarding
# - [ ] GET /auth/me shows is_onboarded true after onboarding
# - [ ] Cookie remains valid after onboarding
# - [ ] Organization name updated
# - [ ] Unverified user blocked from onboarding (403)
# - [ ] Already onboarded user blocked (400)
