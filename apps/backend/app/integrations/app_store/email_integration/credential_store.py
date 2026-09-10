from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import UUID

import redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential

EMAIL_SLUG = "email"
VERIFY_ACTION_TTL_SECONDS = 3600
VERIFY_TOKEN_TTL_SECONDS = 3600
VERIFY_ERROR_TTL_SECONDS = 24 * 3600
INBOUND_LOOKUP_TTL_SECONDS = 300
VERIFICATION_TIMEOUT_MINUTES = 15


def _redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


async def _email_integration_id(db: AsyncSession) -> UUID | None:
    result = await db.execute(select(Integration.id).where(Integration.slug == EMAIL_SLUG))
    return result.scalar_one_or_none()


def build_config(
    *,
    inbound_address: str | None,
    provider: str | None,
    secret_hash: str | None,
    verification_status: str | None,
    verified_at: datetime | None,
    verification_provider: str | None,
    verification_email_id: UUID | None,
) -> dict:
    cfg = {
        "inbound_address": inbound_address,
        "provider": provider,
        "secret_hash": secret_hash,
        "verification_status": verification_status,
        "verified_at": verified_at.isoformat() if verified_at else None,
        "verification_provider": verification_provider,
        "verification_email_id": str(verification_email_id) if verification_email_id else None,
    }
    return {k: v for k, v in cfg.items() if v is not None}


def parse_verified_at(config: dict) -> datetime | None:
    value = (config or {}).get("verified_at")
    return parse_iso_datetime(value)


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


async def get_credential(
    db: AsyncSession, *, org_id: UUID, job_id: UUID | None
) -> IntegrationCredential | None:
    integration_id = await _email_integration_id(db)
    if integration_id is None:
        return None
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_id == integration_id,
            IntegrationCredential.job_id == job_id,
        )
    )
    return result.scalar_one_or_none()


async def upsert_credential(
    db: AsyncSession,
    *,
    org_id: UUID,
    job_id: UUID | None,
    status: str,
    config: dict,
) -> IntegrationCredential:
    integration_id = await _email_integration_id(db)
    if integration_id is None:
        raise ValueError("Email integration not found")
    row = await get_credential(db, org_id=org_id, job_id=job_id)
    if row is None:
        row = IntegrationCredential(
            org_id=org_id,
            integration_id=integration_id,
            job_id=job_id,
            status=status,
            config=config,
        )
        db.add(row)
    else:
        row.status = status
        row.config = config
    return row


async def get_org_credential_by_address(
    db: AsyncSession, inbound_address: str
) -> IntegrationCredential | None:
    integration_id = await _email_integration_id(db)
    if integration_id is None:
        return None
    normalized = (inbound_address or "").strip().lower()
    from sqlalchemy import or_
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_id == integration_id,
            IntegrationCredential.job_id.is_(None),
            or_(
                IntegrationCredential.config["inbound_address"].astext == normalized,
                IntegrationCredential.config["mailbox_email"].astext == normalized,
            ),
        )
    )
    return result.scalar_one_or_none()


async def get_job_credential_by_address(
    db: AsyncSession, inbound_address: str
) -> IntegrationCredential | None:
    integration_id = await _email_integration_id(db)
    if integration_id is None:
        return None
    normalized = (inbound_address or "").strip().lower()
    from sqlalchemy import or_
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_id == integration_id,
            IntegrationCredential.job_id.is_not(None),
            or_(
                IntegrationCredential.config["inbound_address"].astext == normalized,
                IntegrationCredential.config["mailbox_email"].astext == normalized,
            ),
        )
    )
    return result.scalar_one_or_none()


def _cache_key_action(credential_id: UUID) -> str:
    return f"email_integration:verify_action:{credential_id}"


def _cache_key_token(credential_id: UUID) -> str:
    return f"email_integration:verify_token:{credential_id}"


def _cache_key_error(credential_id: UUID) -> str:
    return f"email_integration:verify_error:{credential_id}"


def _cache_key_lookup(inbound_address: str) -> str:
    return f"email_integration:inbound_lookup:{(inbound_address or '').strip().lower()}"


def clear_verification_cache(credential_id: UUID) -> None:
    try:
        client = _redis_client()
        client.delete(
            _cache_key_action(credential_id),
            _cache_key_token(credential_id),
            _cache_key_error(credential_id),
        )
    except Exception:
        return


def cache_set_verify_action(credential_id: UUID, payload: dict) -> None:
    try:
        _redis_client().setex(
            _cache_key_action(credential_id), VERIFY_ACTION_TTL_SECONDS, json.dumps(payload)
        )
    except Exception:
        return


def cache_get_verify_action(credential_id: UUID) -> dict | None:
    try:
        raw = _redis_client().get(_cache_key_action(credential_id))
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_set_verify_token(credential_id: UUID, payload: dict) -> None:
    try:
        _redis_client().setex(
            _cache_key_token(credential_id), VERIFY_TOKEN_TTL_SECONDS, json.dumps(payload)
        )
    except Exception:
        return


def cache_get_verify_token(credential_id: UUID) -> dict | None:
    try:
        raw = _redis_client().get(_cache_key_token(credential_id))
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_set_verify_error(credential_id: UUID, message: str) -> None:
    try:
        _redis_client().setex(
            _cache_key_error(credential_id), VERIFY_ERROR_TTL_SECONDS, message or ""
        )
    except Exception:
        return


def cache_get_verify_error(credential_id: UUID) -> str | None:
    try:
        return _redis_client().get(_cache_key_error(credential_id))
    except Exception:
        return None


def cache_set_inbound_lookup(inbound_address: str, payload: dict) -> None:
    try:
        _redis_client().setex(
            _cache_key_lookup(inbound_address), INBOUND_LOOKUP_TTL_SECONDS, json.dumps(payload)
        )
    except Exception:
        return


def cache_get_inbound_lookup(inbound_address: str) -> dict | None:
    try:
        raw = _redis_client().get(_cache_key_lookup(inbound_address))
        return json.loads(raw) if raw else None
    except Exception:
        return None


def verification_started_at(config: dict) -> datetime | None:
    return parse_iso_datetime((config or {}).get("verification_started_at"))


def is_verification_expired(config: dict) -> bool:
    status = str((config or {}).get("verification_status") or "pending").strip().lower()
    if status in {"verified"}:
        return False
    started_at = verification_started_at(config)
    if started_at is None:
        return False
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return started_at + timedelta(minutes=VERIFICATION_TIMEOUT_MINUTES) < datetime.now(timezone.utc)


async def expire_pending_credential_if_needed(
    db: AsyncSession, credential: IntegrationCredential | None
) -> bool:
    if credential is None:
        return False
    if not is_verification_expired(credential.config or {}):
        return False
    clear_verification_cache(credential.id)
    await db.delete(credential)
    await db.commit()
    return True
