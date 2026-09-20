"""Short-lived, single-use OAuth requests bound to the initiating browser."""

import hashlib
import json
import secrets

from fastapi import HTTPException
from redis.asyncio import Redis

from app.core.config import settings

STATE_TTL = 600


def cookie_name(state: str) -> str:
    return "linkedin_oauth_" + hashlib.sha256(state.encode()).hexdigest()[:24]


async def create_request(org_id: str, user_id: str, scopes: list[str]) -> tuple[str, str, str]:
    state = secrets.token_urlsafe(32)
    binding = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    data = {
        "org_id": str(org_id), "user_id": str(user_id), "scopes": scopes,
        "binding": hashlib.sha256(binding.encode()).hexdigest(), "verifier": verifier,
    }
    async with Redis.from_url(settings.redis_url, socket_timeout=5) as redis:
        await redis.set("linkedin:oauth:" + state, json.dumps(data), ex=STATE_TTL, nx=True)
    return state, binding, verifier


async def consume_request(state: str | None, binding: str | None) -> dict:
    if not state or len(state) > 128 or not binding:
        raise HTTPException(400, "Invalid or expired LinkedIn connection. Connect again.")
    key = "linkedin:oauth:" + state
    async with Redis.from_url(settings.redis_url, socket_timeout=5) as redis:
        raw = await redis.get(key)
        if not raw or not secrets.compare_digest(
            json.loads(raw)["binding"], hashlib.sha256(binding.encode()).hexdigest()
        ):
            raise HTTPException(400, "Invalid or expired LinkedIn connection. Connect again.")
        consumed = await redis.getdel(key)
    if consumed != raw:
        raise HTTPException(400, "LinkedIn connection was already used. Connect again.")
    return json.loads(consumed)
