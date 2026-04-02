from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create JWT access token with configurable expiry."""
    payload = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    payload.update({"exp": expire, "iat": datetime.now(timezone.utc).timestamp()})
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict[str, Any]) -> str:
    """Create long-lived refresh token (7 days)."""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload.update(
        {"exp": expire, "iat": datetime.now(timezone.utc).timestamp(), "type": "refresh"}
    )
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        # Ensure it's not a refresh token being used as access token
        if payload.get("type") == "refresh":
            raise ValueError("Refresh token cannot be used as access token")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid token") from exc


def verify_refresh_token(token: str) -> dict[str, Any]:
    """Verify and decode refresh token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid refresh token") from exc
