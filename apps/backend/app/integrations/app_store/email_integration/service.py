import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.app_store.email_integration import credential_store
from app.integrations.app_store.email_integration.provider_logic import (
    build_verification_state,
    detect_provider,
    hash_verification_code,
)
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.schemas.integrations import (
    IntegrationAppDescriptor,
    IntegrationEmailConfigResponse,
    IntegrationInstalledApp,
    IntegrationOwnerContext,
)
from app.schemas.organization import (
    OrgInboxActionResponse,
    OrgInboxCodeVerifyRequest,
    OrgInboxResponse,
    UpsertOrgInboxRequest,
)

APP_ID = "email_integration"
APP_SLUG = "email-integration"
APP_NAME = "Email Integration"


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


def _cfg_str(config: dict, key: str, default: str | None = None) -> str | None:
    value = (config or {}).get(key)
    if value is None:
        return default
    return str(value)


def _cfg_uuid(config: dict, key: str) -> UUID | None:
    value = (config or {}).get(key)
    if not value:
        return None
    try:
        return UUID(str(value))
    except Exception:
        return None


def to_org_inbox_response(org_id: UUID, cred: IntegrationCredential) -> OrgInboxResponse:
    cfg = cred.config or {}
    verification_action_url = None
    action_payload = credential_store.cache_get_verify_action(cred.id) or {}
    action_type = _cfg_str(cfg, "verification_action_type") or str(
        (action_payload or {}).get("type") or ""
    )
    if (action_type or "").strip().lower() == "link":
        payload = dict(action_payload or {})
        candidate_url = str(payload.get("url") or "").strip()
        if candidate_url and _is_allowed_verification_url(candidate_url):
            verification_action_url = candidate_url
    return OrgInboxResponse(
        id=cred.id,
        org_id=org_id,
        inbox_address=_cfg_str(cfg, "inbound_address", "") or "",
        provider=_cfg_str(cfg, "provider", "ses") or "ses",
        provider_key=_cfg_str(cfg, "provider_key", _cfg_str(cfg, "provider", "")) or "",
        provider_detection_source=_cfg_str(cfg, "provider_detection_source"),
        provider_detection_confidence=_cfg_str(cfg, "provider_detection_confidence"),
        mailbox_type=_cfg_str(cfg, "mailbox_type"),
        expected_verification_mode=_cfg_str(cfg, "expected_verification_mode", "link") or "link",
        active_verification_mode=_cfg_str(
            cfg,
            "active_verification_mode",
            _cfg_str(cfg, "expected_verification_mode", "link"),
        )
        or "link",
        status=cred.status or "pending",
        verification_status=_cfg_str(cfg, "verification_status", "pending") or "pending",
        verification_provider=_cfg_str(cfg, "verification_provider"),
        verification_confirmed_via=_cfg_str(cfg, "verification_confirmed_via"),
        verification_action_type=action_type or None,
        verification_action_url=verification_action_url,
        verification_code_value=_cfg_str(cfg, "verification_code_value"),
        verification_detected_at=None,
        verification_error=credential_store.cache_get_verify_error(cred.id),
        verified_at=credential_store.parse_verified_at(cfg),
        verification_expires_at=None,
    )


async def get_org_inbox(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> IntegrationCredential | None:
    return await credential_store.get_credential(db, org_id=owner.org_id, job_id=None)


async def get_email_config(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> IntegrationEmailConfigResponse:
    inbox = await get_org_inbox(db, owner)
    if await credential_store.expire_pending_credential_if_needed(db, inbox):
        return IntegrationEmailConfigResponse(inbox=None, configured=False, status="timed_out")
    if inbox is None:
        return IntegrationEmailConfigResponse(inbox=None, configured=False, status="not_configured")
    cfg = inbox.config or {}
    if not (cfg.get("inbound_address") or "").strip():
        return IntegrationEmailConfigResponse(inbox=None, configured=False, status="not_configured")
    return IntegrationEmailConfigResponse(
        inbox=to_org_inbox_response(owner.org_id, inbox),
        configured=True,
        status=inbox.status,
    )


async def upsert_email_config(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    body: UpsertOrgInboxRequest,
) -> OrgInboxResponse:
    normalized_address = _normalize_inbox_address(body.inbox_address)
    detection = detect_provider(normalized_address)
    provider_key = detection["provider_key"]
    if not provider_key:
        raise HTTPException(
            status_code=400,
            detail="Unsupported provider. Only Google, Microsoft, and Zoho mailboxes are supported.",
        )
    email_integration = await db.execute(select(Integration).where(Integration.slug == "email"))
    integration = email_integration.scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=500, detail="Email integration not found")
    existing_by_address_result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_id == integration.id,
            IntegrationCredential.job_id.is_(None),
            IntegrationCredential.org_id != owner.org_id,
            IntegrationCredential.config["inbound_address"].astext == normalized_address,
        )
    )
    if existing_by_address_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Inbox address already configured")

    inbox = await get_org_inbox(db, owner)
    cfg = dict((inbox.config if inbox else {}) or {})
    current_address = _normalize_inbox_address(str(cfg.get("inbound_address") or ""))
    current_provider = str(cfg.get("provider_key") or cfg.get("provider") or "").strip().lower()
    address_unchanged = current_address == normalized_address and current_provider == provider_key
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
        org_id=owner.org_id,
        job_id=None,
        status="pending" if not address_unchanged else (inbox.status if inbox else "pending"),
        config=cfg,
    )
    await db.commit()
    await db.refresh(row)
    return to_org_inbox_response(owner.org_id, row)


async def rotate_secret(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    inbox = await get_org_inbox(db, owner)
    if await credential_store.expire_pending_credential_if_needed(db, inbox):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")

    plain_secret = secrets.token_urlsafe(32)
    cfg = dict(inbox.config or {})
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
    credential_store.cache_set_verify_token(
        inbox.id,
        {
            "verification_token_hash": _hash_secret(plain_secret),
            "verification_expires_at": (
                datetime.now(timezone.utc) + timedelta(hours=24)
            ).isoformat(),
        },
    )
    inbox.config = cfg
    inbox.status = "pending"
    await db.commit()

    return OrgInboxActionResponse(
        status="pending",
        message=f"New inbound secret generated: {plain_secret}",
    )


async def activate(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    inbox = await get_org_inbox(db, owner)
    if await credential_store.expire_pending_credential_if_needed(db, inbox):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    cfg = dict(inbox.config or {})
    if not cfg.get("secret_hash") and settings.inbound_webhook_secret:
        cfg["secret_hash"] = settings.inbound_webhook_secret
    cfg["verification_status"] = "verified"
    cfg["verified_at"] = datetime.now(timezone.utc).isoformat()
    inbox.config = cfg
    inbox.status = "active"
    await db.commit()

    return OrgInboxActionResponse(status="active", message="Inbox is active")


async def verify_now(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    inbox = await get_org_inbox(db, owner)
    if await credential_store.expire_pending_credential_if_needed(db, inbox):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    cfg = dict(inbox.config or {})
    if str(cfg.get("verification_status") or "pending") != "action_required":
        raise HTTPException(status_code=409, detail="Verification action not available")
    payload = credential_store.cache_get_verify_action(inbox.id) or {}
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
        inbox.config = cfg
        credential_store.cache_set_verify_error(inbox.id, "Verification URL host is not allowed")
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification URL is not allowed")

    return OrgInboxActionResponse(
        status="action_required",
        message="Open verification link and complete provider confirmation",
        action_url=verify_url,
    )


async def verify_complete(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    inbox = await get_org_inbox(db, owner)
    if await credential_store.expire_pending_credential_if_needed(db, inbox):
        raise HTTPException(status_code=410, detail="Verification request timed out")
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    cfg = dict(inbox.config or {})
    if str(cfg.get("verification_status") or "pending") not in {"action_required", "verified"}:
        raise HTTPException(status_code=409, detail="Verification action not available")
    cfg["verification_status"] = "verified"
    cfg["verified_at"] = datetime.now(timezone.utc).isoformat()
    cfg["verification_confirmed_via"] = "link"
    cfg["verification_code_value"] = None
    inbox.config = cfg
    inbox.status = "active"
    await db.commit()

    return OrgInboxActionResponse(status="active", message="Inbox verified and active")


async def verify_code(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    body: OrgInboxCodeVerifyRequest,
) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    cfg = dict(inbox.config or {})
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
    inbox.config = cfg
    inbox.status = "active"
    await db.commit()
    return OrgInboxActionResponse(status="active", message="Inbox verified and active")


async def disconnect(db: AsyncSession, owner: IntegrationOwnerContext) -> None:
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="No email integration configured")
    await db.delete(inbox)
    await db.commit()


async def list_apps(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> list[IntegrationAppDescriptor]:
    inbox = await get_org_inbox(db, owner)
    inbound_address = (inbox.config or {}).get("inbound_address") if inbox else None
    status = inbox.status if (inbox is not None and inbound_address) else "not_installed"
    installed = inbox is not None and inbound_address is not None and inbox.status == "active"
    return [
        IntegrationAppDescriptor(
            app_id=APP_ID,
            slug=APP_SLUG,
            name=APP_NAME,
            category="email",
            description="Inbound careers inbox processing via SES/S3/SNS and Temporal workflows.",
            status=status,
            installed=installed,
        )
    ]


async def list_installed_apps(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> list[IntegrationInstalledApp]:
    inbox = await get_org_inbox(db, owner)
    if inbox is None or not (inbox.config or {}).get("inbound_address"):
        return []
    return [
        IntegrationInstalledApp(
            app_id=APP_ID,
            slug=APP_SLUG,
            name=APP_NAME,
            status=inbox.status,
            installed_at=inbox.created_at,
            configured=True,
        )
    ]
