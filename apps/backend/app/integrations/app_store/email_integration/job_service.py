import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.app_store.email_integration import credential_store
from app.integrations.app_store.email_integration.provider_logic import (
    build_verification_state,
    detect_provider,
    hash_verification_code,
)
from app.models.integration_credential import IntegrationCredential
from app.models.job import Job
from app.schemas.jobs import (
    JobEmailActionResponse,
    JobEmailCodeVerifyRequest,
    JobEmailConfigResponse,
    JobEmailConfigUpsertRequest,
    JobEmailInboxResponse,
)


def _normalize_inbox_address(value: str) -> str:
    return value.strip().lower()


def _hash_secret(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _is_allowed_verification_url(value: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(value)
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    allowed_suffixes = (
        "google.com",
        "mail.google.com",
        "support.google.com",
        "outlook.com",
        "office.com",
        "microsoft.com",
        "live.com",
    )
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in allowed_suffixes)


def _to_job_inbox_response_from_cred(
    job: Job, cred: IntegrationCredential
) -> JobEmailInboxResponse:
    cfg = cred.config or {}
    action_payload = credential_store.cache_get_verify_action(cred.id) or {}
    action_type = str(action_payload.get("type") or cfg.get("verification_action_type") or "")
    verification_action_url = None
    if action_type.strip().lower() == "link":
        candidate_url = str((action_payload or {}).get("url") or "").strip()
        if candidate_url and _is_allowed_verification_url(candidate_url):
            verification_action_url = candidate_url
    return JobEmailInboxResponse(
        job_id=job.id,
        org_id=job.org_id,
        inbox_address=str(cfg.get("inbound_address") or ""),
        provider=str(cfg.get("provider") or "ses"),
        provider_key=str(cfg.get("provider_key") or cfg.get("provider") or ""),
        provider_detection_source=str(cfg.get("provider_detection_source") or "") or None,
        provider_detection_confidence=str(cfg.get("provider_detection_confidence") or "") or None,
        mailbox_type=str(cfg.get("mailbox_type") or "") or None,
        expected_verification_mode=str(cfg.get("expected_verification_mode") or "link"),
        active_verification_mode=str(
            cfg.get("active_verification_mode") or cfg.get("expected_verification_mode") or "link"
        ),
        status=cred.status or "inactive",
        verification_status=str(cfg.get("verification_status") or "pending"),
        verification_provider=str(cfg.get("verification_provider") or "") or None,
        verification_confirmed_via=str(cfg.get("verification_confirmed_via") or "") or None,
        verification_action_type=action_type or None,
        verification_action_url=verification_action_url,
        verification_code_value=str(cfg.get("verification_code_value") or "") or None,
        verification_detected_at=None,
        verification_error=credential_store.cache_get_verify_error(cred.id),
        verified_at=credential_store.parse_verified_at(cfg),
        verification_expires_at=None,
    )


async def _get_job_or_404(db: AsyncSession, org_id: UUID, job_id: UUID) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id, Job.org_id == org_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def get_job_email_config(
    db: AsyncSession, org_id: UUID, job_id: UUID
) -> JobEmailConfigResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if await credential_store.expire_pending_credential_if_needed(db, cred):
        return JobEmailConfigResponse(inbox=None, configured=False, status="timed_out")
    configured = bool((cred and (cred.config or {}).get("inbound_address")))
    if not configured:
        return JobEmailConfigResponse(inbox=None, configured=False, status="not_configured")
    return JobEmailConfigResponse(
        inbox=_to_job_inbox_response_from_cred(job, cred),
        configured=True,
        status=cred.status or "inactive",
    )


async def upsert_job_email_config(
    db: AsyncSession,
    org_id: UUID,
    job_id: UUID,
    body: JobEmailConfigUpsertRequest,
) -> JobEmailConfigResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    normalized_address = _normalize_inbox_address(body.inbox_address)
    detection = detect_provider(normalized_address)
    provider_key = detection["provider_key"]
    if not provider_key:
        raise HTTPException(
            status_code=400,
            detail="Unsupported provider. Only Google, Microsoft, and Zoho mailboxes are supported.",
        )
    collision_result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.job_id.is_not(None),
            IntegrationCredential.job_id != job_id,
            IntegrationCredential.config["inbound_address"].astext == normalized_address,
        )
    )
    if collision_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Inbox address already configured")

    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    cfg = dict((cred.config if cred else {}) or {})
    address_unchanged = (
        str(cfg.get("inbound_address") or "").strip().lower()
    ) == normalized_address and str(
        cfg.get("provider_key") or cfg.get("provider") or ""
    ).strip().lower() == provider_key
    if not address_unchanged:
        cfg = build_verification_state(
            normalized_address,
            preserve_secret=str(cfg.get("secret_hash") or "") or None,
        )
    else:
        cfg["provider_key"] = provider_key
        cfg["provider"] = provider_key
        cfg["mailbox_email"] = normalized_address
        cfg["inbound_address"] = normalized_address
        cfg["provider_detection_source"] = detection["detection_source"]
        cfg["provider_detection_confidence"] = detection["detection_confidence"]
        cfg["mailbox_type"] = detection["mailbox_type"]

    row = await credential_store.upsert_credential(
        db,
        org_id=org_id,
        job_id=job.id,
        status="pending" if not address_unchanged else (cred.status if cred else "pending"),
        config=cfg,
    )
    await db.commit()
    return JobEmailConfigResponse(
        inbox=_to_job_inbox_response_from_cred(job, row),
        configured=True,
        status=row.status or "inactive",
    )


async def rotate_job_email_secret(
    db: AsyncSession,
    org_id: UUID,
    job_id: UUID,
) -> JobEmailActionResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if await credential_store.expire_pending_credential_if_needed(db, cred):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if cred is None or not (cred.config or {}).get("inbound_address"):
        raise HTTPException(status_code=404, detail="Job inbox configuration not found")

    plain_secret = secrets.token_urlsafe(32)
    cfg = dict(cred.config or {})
    cfg["secret_hash"] = plain_secret
    cfg["verification_status"] = "pending"
    cfg["verification_started_at"] = datetime.now(timezone.utc).isoformat()
    cfg["active_verification_mode"] = str(
        cfg.get("expected_verification_mode") or cfg.get("active_verification_mode") or "link"
    )
    cfg["verification_action_type"] = None
    cfg["verification_confirmed_via"] = None
    cfg["verification_code_hash"] = None
    cfg["verification_code_expires_at"] = None
    cfg["verification_code_value"] = None
    cfg.pop("verified_at", None)
    cfg.pop("verification_provider", None)
    cfg.pop("verification_email_id", None)
    cred.config = cfg
    cred.status = "pending"
    credential_store.cache_set_verify_token(
        cred.id,
        {
            "verification_token_hash": _hash_secret(plain_secret),
            "verification_expires_at": (
                datetime.now(timezone.utc) + timedelta(hours=24)
            ).isoformat(),
        },
    )
    await db.commit()
    return JobEmailActionResponse(
        status="pending",
        message=f"New inbound secret generated: {plain_secret}",
    )


async def verify_now_job_email(
    db: AsyncSession, org_id: UUID, job_id: UUID
) -> JobEmailActionResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if await credential_store.expire_pending_credential_if_needed(db, cred):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if cred is None:
        raise HTTPException(status_code=404, detail="Job inbox configuration not found")
    cfg = dict(cred.config or {})
    if str(cfg.get("verification_status") or "pending") != "action_required":
        raise HTTPException(status_code=409, detail="Verification action not available")

    payload = credential_store.cache_get_verify_action(cred.id) or {}
    action_type = (
        str(payload.get("type") or cfg.get("verification_action_type") or "").strip().lower()
    )
    if action_type != "link":
        raise HTTPException(status_code=409, detail="Unsupported verification action")
    verify_url = str(payload.get("url") or "").strip()
    if not verify_url:
        raise HTTPException(status_code=409, detail="Verification URL missing")
    if not _is_allowed_verification_url(verify_url):
        cfg["verification_status"] = "failed"
        cred.config = cfg
        credential_store.cache_set_verify_error(cred.id, "Verification URL host is not allowed")
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification URL is not allowed")

    return JobEmailActionResponse(
        status="action_required",
        message="Open verification link and complete provider confirmation",
        action_url=verify_url,
    )


async def verify_complete_job_email(
    db: AsyncSession, org_id: UUID, job_id: UUID
) -> JobEmailActionResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if await credential_store.expire_pending_credential_if_needed(db, cred):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if cred is None:
        raise HTTPException(status_code=404, detail="Job inbox configuration not found")
    cfg = dict(cred.config or {})
    if str(cfg.get("verification_status") or "pending") not in {"action_required", "verified"}:
        raise HTTPException(status_code=409, detail="Verification action not available")

    cfg["verification_status"] = "verified"
    cfg["verified_at"] = datetime.now(timezone.utc).isoformat()
    cfg["verification_confirmed_via"] = "link"
    cfg["verification_code_value"] = None
    cred.config = cfg
    cred.status = "active"
    await db.commit()
    return JobEmailActionResponse(status="active", message="Inbox verified and active")


async def verify_code_job_email(
    db: AsyncSession,
    org_id: UUID,
    job_id: UUID,
    body: JobEmailCodeVerifyRequest,
) -> JobEmailActionResponse:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if await credential_store.expire_pending_credential_if_needed(db, cred):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if cred is None:
        raise HTTPException(status_code=404, detail="Job inbox configuration not found")
    cfg = dict(cred.config or {})
    if str(cfg.get("active_verification_mode") or "") != "code":
        raise HTTPException(status_code=409, detail="Verification code is not required")
    expected_hash = str(cfg.get("verification_code_hash") or "").strip()
    if not expected_hash:
        raise HTTPException(status_code=409, detail="Verification code not available")
    expires_at = credential_store.parse_iso_datetime(cfg.get("verification_code_expires_at"))
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Verification code expired")
    if hash_verification_code(body.code.strip()) != expected_hash:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    cfg["verification_status"] = "verified"
    cfg["verified_at"] = datetime.now(timezone.utc).isoformat()
    cfg["verification_confirmed_via"] = "code"
    cfg["verification_code_hash"] = None
    cfg["verification_code_expires_at"] = None
    cfg["verification_code_value"] = None
    cred.config = cfg
    cred.status = "active"
    await db.commit()
    return JobEmailActionResponse(status="active", message="Inbox verified and active")


async def disconnect_job_email(db: AsyncSession, org_id: UUID, job_id: UUID) -> None:
    job = await _get_job_or_404(db, org_id, job_id)
    cred = await credential_store.get_credential(db, org_id=org_id, job_id=job.id)
    if cred is None:
        raise HTTPException(status_code=404, detail="No job email integration configured")
    await db.delete(cred)
    await db.commit()
