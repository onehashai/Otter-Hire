import secrets as _secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
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
    payload.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc).timestamp(),
            # jti (JWT ID) — unique per token so it can be individually revoked in Redis on logout.
            "jti": _secrets.token_hex(16),
        }
    )
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def generate_opaque_refresh_token() -> tuple[str, str]:
    """Generate a cryptographically random opaque refresh token.
    Returns (raw_token, token_hash) — store only the hash, send raw in cookie.
    """
    raw = _secrets.token_urlsafe(48)
    token_hash = sha256(raw.encode()).hexdigest()
    return raw, token_hash


def verify_access_token(token: str) -> dict[str, Any]:
    """Verify and decode JWT access token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        # Ensure it's not an old-style JWT refresh token being used as access token
        if payload.get("type") == "refresh":
            raise ValueError("Refresh token cannot be used as access token")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
