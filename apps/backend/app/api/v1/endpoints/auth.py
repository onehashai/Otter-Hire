from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest, SignupRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        org_id=user.org_id,
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
async def signup(payload: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AuthUserResponse:
    normalized_email = payload.email.lower()

    existing_user = await db.execute(select(User).where(User.email == normalized_email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    org_name = f"{(payload.name or normalized_email).split('@')[0]} Organization"
    organization = Organization(id=uuid4(), name=org_name)
    db.add(organization)
    await db.flush()

    user = User(
        id=uuid4(),
        org_id=organization.id,
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        name=payload.name or normalized_email.split("@")[0],
        role="admin",
        status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

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
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> AuthUserResponse:
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
