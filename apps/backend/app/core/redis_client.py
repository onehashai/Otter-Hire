"""Redis client utilities for the ATS backend.

Account-level brute-force tracking (login_attempts):
  Key  : ats:auth:fails:{sha256(email)}  — email is hashed so plaintext never
         lands in Redis even if the instance is compromised.
  Value: integer count of consecutive failures.
  TTL  : 15 minutes from the *first* failure in the window (fixed window).
         A successful login clears the key immediately.
  Limit: 10 failures → account locked for the remainder of the window.

The counter is incremented for *every* login failure regardless of whether
the account exists, so attackers cannot infer account existence by observing
when the lockout kicks in (vs. the IP-level rate limit triggering first).


Provides a lazily-initialised async Redis client and helpers for the
access-token blacklist used to immediately revoke JWTs on logout.

Design notes:
- The client is module-level so it is shared across all requests in the same
  worker process without re-creating the connection pool on every call.
- All blacklist operations catch Redis errors and fail open (allow the request)
  so that a Redis outage does not take down authentication entirely.  The
  15-minute access-token TTL bounds the exposure window in that case.
- Keys are prefixed with "ats:auth:bl:" and automatically expire at the same
  time the JWT would have expired, so no manual cleanup is needed.
"""

import logging
from datetime import datetime, timezone
from hashlib import sha256

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_BLACKLIST_PREFIX = "ats:auth:bl:"


def get_redis_client() -> aioredis.Redis:
    """Return (or lazily create) the module-level async Redis client."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def blacklist_access_token(jti: str, exp: int) -> None:
    """Add a JWT jti to the blacklist with TTL matching the token's remaining lifetime.

    Call this on logout and on token refresh (to invalidate the previous access token).
    Safe to call with an already-expired token — it is a no-op in that case.
    """
    ttl = exp - int(datetime.now(timezone.utc).timestamp())
    if ttl <= 0:
        return  # Token is already expired; blacklisting would be pointless
    try:
        client = get_redis_client()
        await client.setex(f"{_BLACKLIST_PREFIX}{jti}", ttl, "1")
    except Exception:
        logger.warning(
            "Failed to blacklist access token jti=%s — Redis unavailable. "
            "Token remains valid until natural expiry.",
            jti,
        )


async def is_token_blacklisted(jti: str) -> bool:
    """Return True if the jti has been explicitly revoked (logout or rotation).

    Fails open: if Redis is unavailable the token is treated as NOT blacklisted
    so that a Redis outage does not break all authenticated requests.
    """
    try:
        client = get_redis_client()
        return bool(await client.exists(f"{_BLACKLIST_PREFIX}{jti}"))
    except Exception:
        logger.warning(
            "Failed to check token blacklist for jti=%s — Redis unavailable. "
            "Allowing request (fail-open policy).",
            jti,
        )
        return False


# ---------------------------------------------------------------------------
# Account-level brute-force protection
# ---------------------------------------------------------------------------

_LOGIN_FAILS_PREFIX = "ats:auth:fails:"
_LOGIN_FAILS_WINDOW = 900  # 15-minute fixed window (seconds)
_LOGIN_FAILS_LIMIT = 10  # lock after this many consecutive failures


def _login_fails_key(email: str) -> str:
    """Return a Redis key for the given email — hashed so plaintext never stored."""
    return f"{_LOGIN_FAILS_PREFIX}{sha256(email.lower().encode()).hexdigest()}"


async def is_login_locked(email: str) -> bool:
    """Return True if the account has exceeded the failed-login threshold.

    Fails open (returns False) if Redis is unavailable so a Redis outage
    cannot lock every user out of their account.
    """
    try:
        client = get_redis_client()
        val = await client.get(_login_fails_key(email))
        return int(val) >= _LOGIN_FAILS_LIMIT if val else False
    except Exception:
        logger.warning(
            "Failed to check login lock for account — Redis unavailable. "
            "Allowing login attempt (fail-open policy).",
        )
        return False


async def record_failed_login(email: str) -> int:
    """Increment the failed-login counter for this email.

    Sets a 15-minute TTL on the first failure so the window resets
    automatically if the attacker stops trying.  Returns the new count.
    """
    try:
        client = get_redis_client()
        key = _login_fails_key(email)
        count = await client.incr(key)
        if count == 1:
            # First failure in this window — arm the expiry
            await client.expire(key, _LOGIN_FAILS_WINDOW)
        return count
    except Exception:
        logger.warning(
            "Failed to record failed login — Redis unavailable.",
        )
        return 0


async def clear_failed_logins(email: str) -> None:
    """Remove the failed-login counter after a successful authentication."""
    try:
        client = get_redis_client()
        await client.delete(_login_fails_key(email))
    except Exception:
        logger.warning(
            "Failed to clear login counter — Redis unavailable.",
        )
