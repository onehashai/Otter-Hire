import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from app.utils.uuid import uuid7

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    AcceptInviteRequest,
    AuthUserResponse,
    InviteDetailsResponse,
    LoginRequest,
    OnboardingRequest,
    ResendVerificationRequest,
    SignupRequest,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.services.default_categories import create_default_job_categories_for_org
from app.services.default_email_templates import create_default_templates_for_org
from app.services.email import send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


def _to_user_response(user: User, membership: OrgMembership) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        membership_role=membership.role,
        status=membership.status,
        org_id=membership.org_id,
        org_name="",
        org_website=None,
        org_avatar_url=None,
        is_verified=user.is_verified,
        is_onboarded=user.is_onboarded,
    )


def _create_session_token(user: User, membership: OrgMembership) -> str:
    return create_access_token(
        {
            "user_id": str(user.id),
            "org_id": str(membership.org_id),
            "membership_role": membership.role,
            "account_role": user.role,
        }
    )


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


@router.post("/signup", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/15 minutes")
async def signup(
    request: Request, payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthUserResponse:
    normalized_email = payload.email.lower()

    existing_user = await db.execute(select(User).where(User.email == normalized_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    org_name = f"{(payload.name or normalized_email).split('@')[0]} Organization"
    organization = Organization(id=uuid7(), name=org_name)
    db.add(organization)
    await db.flush()

    create_default_job_categories_for_org(db, organization.id)
    create_default_templates_for_org(db, organization.id)

    raw_token = secrets.token_urlsafe(32)
    token_hash = sha256(raw_token.encode()).hexdigest()
    token_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.verification_token_expire_hours
    )

    user = User(
        id=uuid7(),
        org_id=organization.id,
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        name=payload.name or normalized_email.split("@")[0],
        status="active",
        is_verified=False,
        verification_token_hash=token_hash,
        verification_token_expires_at=token_expires_at,
        is_onboarded=False,
    )
    db.add(user)
    await db.flush()
    membership = OrgMembership(
        user_id=user.id,
        org_id=organization.id,
        role="owner",
        status="active",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(membership)

    verify_url = f"{settings.effective_frontend_base_url}/verify?token={raw_token}"
    await send_verification_email(user.email, verify_url)

    token = _create_session_token(user, membership)
    _set_access_cookie(response, token)
    return _to_user_response(user, membership)


@router.post("/login", response_model=AuthUserResponse)
@limiter.limit("5/15 minutes")
async def login(
    request: Request, payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> AuthUserResponse:
    normalized_email = payload.email.lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
            },
        )
    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_GOOGLE_ACCOUNT",
                "message": "This account was created with Google Sign-In. Please use the 'Continue with Google' button.",
            },
        )
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
            },
        )

    membership_result = await db.execute(
        select(OrgMembership)
        .where(OrgMembership.user_id == user.id, OrgMembership.status == "active")
        .order_by(OrgMembership.created_at.asc())
    )
    membership = membership_result.scalars().first()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "AUTH_NO_ACTIVE_MEMBERSHIP",
                "message": "No active organization membership found.",
            },
        )

    token = _create_session_token(user, membership)
    _set_access_cookie(response, token)
    return _to_user_response(user, membership)


@router.get("/me", response_model=AuthUserResponse)
async def me(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> AuthUserResponse:
    membership_result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.org_id == current_user.org_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Membership not found")

    org_result = await db.execute(select(Organization).where(Organization.id == membership.org_id))
    organization = org_result.scalar_one()

    response = _to_user_response(current_user, membership)
    response.org_name = organization.name
    response.org_website = organization.website
    response.org_avatar_url = organization.avatar_url
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(
        key="access_token",
        path="/",
        domain=settings.cookie_domain or None,
        secure=settings.is_production,
        samesite="lax",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/verify", response_model=VerifyEmailResponse)
@limiter.limit("10/15 minutes")
async def verify_email(
    request: Request, payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
) -> VerifyEmailResponse:
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token"
        )

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
        token_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.verification_token_expire_hours
        )

        user.verification_token_hash = token_hash
        user.verification_token_expires_at = token_expires_at
        await db.commit()

        verify_url = f"{settings.effective_frontend_base_url}/verify?token={raw_token}"
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required"
        )

    if current_user.is_onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User already onboarded"
        )

    membership_result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.org_id == current_user.org_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    current_user.name = payload.full_name
    current_user.is_onboarded = True
    if membership.status == "invited":
        membership.status = "active"

    org_result = await db.execute(select(Organization).where(Organization.id == membership.org_id))
    organization = org_result.scalar_one()
    if membership.role == "owner":
        organization.name = payload.organization_name

    await db.commit()
    await db.refresh(current_user)
    await db.refresh(membership)

    token = _create_session_token(current_user, membership)
    _set_access_cookie(response, token)
    return _to_user_response(current_user, membership)


@router.post("/accept-invite", response_model=AuthUserResponse)
@limiter.limit("5/15 minutes")
async def accept_invite(
    request: Request,
    payload: AcceptInviteRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthUserResponse:
    token_hash = sha256(payload.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .where(
            OrgMembership.invite_token_hash == token_hash,
            OrgMembership.invite_token_expires_at > now,
            OrgMembership.status == "invited",
        )
    )
    row = result.first()
    user: User | None = row[1] if row else None
    membership: OrgMembership | None = row[0] if row else None

    if user is None or membership is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token",
        )

    if payload.name:
        user.name = payload.name
    user.hashed_password = hash_password(payload.password)
    membership.status = "invited"
    user.is_verified = False
    user.verified_at = None
    user.is_onboarded = False
    membership.invite_token_hash = None
    membership.invite_token_expires_at = None
    raw_token = secrets.token_urlsafe(32)
    token_hash = sha256(raw_token.encode()).hexdigest()
    token_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.verification_token_expire_hours
    )
    user.verification_token_hash = token_hash
    user.verification_token_expires_at = token_expires_at

    await db.commit()
    await db.refresh(user)
    await db.refresh(membership)
    verify_url = f"{settings.effective_frontend_base_url}/verify?token={raw_token}"
    await send_verification_email(
        to_email=user.email,
        verify_url=verify_url,
    )

    token = _create_session_token(user, membership)
    _set_access_cookie(response, token)
    return _to_user_response(user, membership)


@router.post("/invite/{token}/accept-existing", response_model=AuthUserResponse)
@limiter.limit("10/minute")
async def accept_existing_invite(
    request: Request,
    token: str,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthUserResponse:
    token_hash = sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .where(
            OrgMembership.invite_token_hash == token_hash,
            OrgMembership.invite_token_expires_at > now,
            OrgMembership.status == "invited",
        )
    )
    row = result.first()
    membership: OrgMembership | None = row[0] if row else None
    invited_user: User | None = row[1] if row else None
    if invited_user is None or membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if invited_user.email.lower() != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite email does not match logged-in account",
        )

    invited_user.name = current_user.name
    invited_user.hashed_password = current_user.hashed_password
    membership.status = "active"
    invited_user.is_verified = True
    invited_user.verified_at = current_user.verified_at or now
    invited_user.is_onboarded = True
    membership.invite_token_hash = None
    membership.invite_token_expires_at = None
    invited_user.verification_token_hash = None
    invited_user.verification_token_expires_at = None

    await db.commit()
    await db.refresh(invited_user)
    await db.refresh(membership)

    token_value = _create_session_token(invited_user, membership)
    _set_access_cookie(response, token_value)
    return _to_user_response(invited_user, membership)


@router.get("/invite/{token}", response_model=InviteDetailsResponse)
@limiter.limit("30/minute")
async def get_invite_details(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InviteDetailsResponse:
    token_hash = sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OrgMembership, User, Organization)
        .join(User, OrgMembership.user_id == User.id)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(
            OrgMembership.invite_token_hash == token_hash,
            OrgMembership.invite_token_expires_at > now,
            OrgMembership.status == "invited",
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    membership, user, org = row
    account_exists = bool(user.hashed_password or user.google_id)
    return InviteDetailsResponse(
        org_name=org.name,
        role=membership.role,
        email=user.email,
        account_exists=account_exists,
    )


@router.post("/invite/{token}/decline", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def decline_invite(
    request: Request,
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    token_hash = sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.invite_token_hash == token_hash,
            OrgMembership.invite_token_expires_at > now,
            OrgMembership.status == "invited",
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    membership.status = "disabled"
    membership.invite_token_hash = None
    membership.invite_token_expires_at = None
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_OAUTH_STATE_COOKIE = "oauth_state"
_OAUTH_STATE_TTL_SECONDS = 600  # 10 minutes


@router.get("/google/enabled")
async def google_oauth_enabled() -> dict:
    return {"enabled": settings.google_oauth_enabled}


@router.get("/google")
async def google_oauth_redirect(request: Request, response: Response) -> RedirectResponse:
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    state_token = secrets.token_urlsafe(32)
    state_hash = sha256(state_token.encode()).hexdigest()

    callback_uri = settings.effective_google_redirect_uri
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state_token,
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    redirect = RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
    redirect.set_cookie(
        key=_OAUTH_STATE_COOKIE,
        value=state_hash,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        max_age=_OAUTH_STATE_TTL_SECONDS,
        domain=settings.cookie_domain or None,
    )
    return redirect


@router.get("/google/callback")
async def google_oauth_callback(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    error_base = f"{settings.effective_frontend_base_url}/login"

    def _error_redirect(message: str) -> RedirectResponse:
        params = urllib.parse.urlencode({"oauth_error": message})
        redir = RedirectResponse(url=f"{error_base}?{params}", status_code=status.HTTP_302_FOUND)
        redir.delete_cookie(
            key=_OAUTH_STATE_COOKIE,
            path="/",
            domain=settings.cookie_domain or None,
        )
        return redir

    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error_param = request.query_params.get("error")

    if error_param:
        return _error_redirect("Google sign-in was cancelled or denied.")

    if not code or not state:
        return _error_redirect("Invalid OAuth response from Google.")

    # Validate CSRF state
    stored_state_hash = request.cookies.get(_OAUTH_STATE_COOKIE)
    if not stored_state_hash or sha256(state.encode()).hexdigest() != stored_state_hash:
        return _error_redirect("OAuth state mismatch. Please try signing in again.")

    # Exchange code for tokens — must match exactly what was sent to Google
    callback_uri = settings.effective_google_redirect_uri
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": callback_uri,
                    "grant_type": "authorization_code",
                },
                timeout=10.0,
            )
            if token_resp.status_code != 200:
                return _error_redirect("Failed to exchange code with Google.")

            access_token = token_resp.json().get("access_token")
            if not access_token:
                return _error_redirect("No access token received from Google.")

            userinfo_resp = await client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            if userinfo_resp.status_code != 200:
                return _error_redirect("Failed to fetch user info from Google.")

            userinfo = userinfo_resp.json()
    except httpx.RequestError:
        return _error_redirect("Network error while contacting Google. Please try again.")

    google_id: str | None = userinfo.get("sub")
    email: str | None = userinfo.get("email")
    name: str = userinfo.get("name") or (email.split("@")[0] if email else "User")
    picture: str | None = userinfo.get("picture")

    if not google_id or not email:
        return _error_redirect("Google did not return required account information.")

    normalized_email = email.lower()
    now = datetime.now(timezone.utc)

    # Look up user by google_id first, then by email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()

        if user is not None:
            # Auto-link: existing password account — attach google_id
            user.google_id = google_id
            user.auth_provider = "both" if user.hashed_password else "google"
            if not user.avatar_url and picture:
                user.avatar_url = picture
            await db.commit()
            await db.refresh(user)
        else:
            # New user — create org + user, auto-verified (Google already verified the email)
            org_name = f"{name.split()[0] if name else normalized_email.split('@')[0]} Organization"
            organization = Organization(id=uuid7(), name=org_name)
            db.add(organization)
            await db.flush()

            create_default_job_categories_for_org(db, organization.id)
            create_default_templates_for_org(db, organization.id)

            user = User(
                id=uuid7(),
                org_id=organization.id,
                email=normalized_email,
                hashed_password=None,
                google_id=google_id,
                auth_provider="google",
                name=name,
                status="active",
                is_verified=True,
                verified_at=now,
                is_onboarded=False,
                avatar_url=picture,
            )
            db.add(user)
            await db.flush()

            membership = OrgMembership(
                user_id=user.id,
                org_id=organization.id,
                role="owner",
                status="active",
            )
            db.add(membership)
            await db.commit()
            await db.refresh(user)
            await db.refresh(membership)

            session_token = _create_session_token(user, membership)
            redir = RedirectResponse(
                url=f"{settings.effective_frontend_base_url}/onboarding",
                status_code=status.HTTP_302_FOUND,
            )
            _set_access_cookie(redir, session_token)
            redir.delete_cookie(
                key=_OAUTH_STATE_COOKIE,
                path="/",
                domain=settings.cookie_domain or None,
            )
            return redir

    # Fetch membership for existing/linked user
    membership_result = await db.execute(
        select(OrgMembership)
        .where(OrgMembership.user_id == user.id, OrgMembership.status == "active")
        .order_by(OrgMembership.created_at.asc())
    )
    membership = membership_result.scalars().first()
    if membership is None:
        return _error_redirect("No active organization membership found for this account.")

    dest = (
        f"{settings.effective_frontend_base_url}/onboarding"
        if not user.is_onboarded
        else settings.effective_frontend_base_url
    )
    session_token = _create_session_token(user, membership)
    redir = RedirectResponse(url=dest, status_code=status.HTTP_302_FOUND)
    _set_access_cookie(redir, session_token)
    redir.delete_cookie(
        key=_OAUTH_STATE_COOKIE,
        path="/",
        domain=settings.cookie_domain or None,
    )
    return redir


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
