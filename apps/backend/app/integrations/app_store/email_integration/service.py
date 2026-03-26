import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.models.organization import OrgInbox
from app.schemas.integrations import (
    IntegrationAppDescriptor,
    IntegrationEmailConfigResponse,
    IntegrationInstalledApp,
    IntegrationOwnerContext,
)
from app.schemas.organization import OrgInboxActionResponse, OrgInboxResponse, UpsertOrgInboxRequest

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


def to_org_inbox_response(inbox: OrgInbox) -> OrgInboxResponse:
    verification_action_url = None
    if (inbox.verification_action_type or "").strip().lower() == "link":
        payload = dict(inbox.verification_action_payload or {})
        candidate_url = str(payload.get("url") or "").strip()
        if candidate_url and _is_allowed_verification_url(candidate_url):
            verification_action_url = candidate_url
    return OrgInboxResponse(
        id=inbox.id,
        org_id=inbox.org_id,
        inbox_address=inbox.inbox_address,
        provider=inbox.provider,
        status=inbox.status,
        verification_status=inbox.verification_status or "pending",
        verification_provider=inbox.verification_provider,
        verification_action_type=inbox.verification_action_type,
        verification_action_url=verification_action_url,
        verification_detected_at=inbox.verification_detected_at,
        verification_error=inbox.verification_error,
        verified_at=inbox.verified_at,
        verification_expires_at=inbox.verification_expires_at,
    )


async def _sync_to_integration_credentials(
    db: AsyncSession,
    org_id,
    inbox_address: str,
    provider: str,
    status: str,
) -> None:
    """Sync org_inboxes data to integration_credentials table for tracking."""
    # Get Email integration ID
    result = await db.execute(select(Integration).where(Integration.slug == "email"))
    email_integration = result.scalar_one_or_none()
    if not email_integration:
        return  # Email integration not found, skip sync

    # Upsert integration_credentials
    cred_result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_id == email_integration.id,
        )
    )
    cred = cred_result.scalar_one_or_none()

    config = {
        "inbound_address": inbox_address,
        "provider": provider,
    }

    if cred is None:
        cred = IntegrationCredential(
            org_id=org_id,
            integration_id=email_integration.id,
            config=config,
            status=status,
        )
        db.add(cred)
    else:
        cred.config = config
        cred.status = status


async def get_org_inbox(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInbox | None:
    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == owner.org_id))
    return result.scalar_one_or_none()


async def get_email_config(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> IntegrationEmailConfigResponse:
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        return IntegrationEmailConfigResponse(inbox=None, configured=False, status="not_configured")
    return IntegrationEmailConfigResponse(
        inbox=to_org_inbox_response(inbox),
        configured=True,
        status=inbox.status,
    )


async def upsert_email_config(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    body: UpsertOrgInboxRequest,
) -> OrgInboxResponse:
    normalized_address = _normalize_inbox_address(body.inbox_address)
    existing_by_address_result = await db.execute(
        select(OrgInbox).where(
            OrgInbox.inbox_address == normalized_address,
            OrgInbox.org_id != owner.org_id,
        )
    )
    if existing_by_address_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Inbox address already configured")

    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        inbox = OrgInbox(
            org_id=owner.org_id,
            inbox_address=normalized_address,
            provider=body.provider.strip().lower() or "ses",
            status="pending",
            verification_status="pending",
        )
        db.add(inbox)
    else:
        address_unchanged = _normalize_inbox_address(inbox.inbox_address) == normalized_address
        inbox.inbox_address = normalized_address
        inbox.provider = body.provider.strip().lower() or inbox.provider
        # Only reset verification state when the user actually changed the inbox address
        if not address_unchanged:
            inbox.status = "pending"
            inbox.verified_at = None
            inbox.verification_status = "pending"
            inbox.verification_provider = None
            inbox.verification_email_id = None
            inbox.verification_action_type = None
            inbox.verification_action_payload = None
            inbox.verification_detected_at = None
            inbox.verification_error = None

    await db.commit()
    await db.refresh(inbox)

    # Sync to integration_credentials table
    await _sync_to_integration_credentials(
        db,
        inbox.org_id,
        inbox.inbox_address,
        inbox.provider,
        inbox.status,
    )
    await db.commit()

    return to_org_inbox_response(inbox)


async def rotate_secret(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")

    plain_secret = secrets.token_urlsafe(32)
    inbox.secret_hash = plain_secret
    inbox.verification_token_hash = _hash_secret(plain_secret)
    inbox.verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    inbox.status = "pending"
    inbox.verified_at = None
    inbox.verification_status = "pending"
    inbox.verification_provider = None
    inbox.verification_email_id = None
    inbox.verification_action_type = None
    inbox.verification_action_payload = None
    inbox.verification_detected_at = None
    inbox.verification_error = None
    await db.commit()

    return OrgInboxActionResponse(
        status="pending",
        message=f"New inbound secret generated: {plain_secret}",
    )


async def activate(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")

    if not inbox.secret_hash and settings.inbound_webhook_secret:
        inbox.secret_hash = settings.inbound_webhook_secret

    inbox.status = "active"
    inbox.verification_status = "verified"
    inbox.verification_error = None
    inbox.verified_at = datetime.now(timezone.utc)
    await db.commit()

    # Sync status to integration_credentials
    await _sync_to_integration_credentials(
        db,
        inbox.org_id,
        inbox.inbox_address,
        inbox.provider,
        inbox.status,
    )
    await db.commit()

    return OrgInboxActionResponse(status="active", message="Inbox is active")


async def verify_now(db: AsyncSession, owner: IntegrationOwnerContext) -> OrgInboxActionResponse:
    if owner.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    if inbox.verification_status != "action_required":
        raise HTTPException(status_code=409, detail="Verification action not available")

    payload = dict(inbox.verification_action_payload or {})
    action_type = (inbox.verification_action_type or "").strip().lower()

    if action_type != "link":
        raise HTTPException(status_code=409, detail="Unsupported verification action")
    verify_url = str(payload.get("url") or "").strip()
    if not verify_url:
        raise HTTPException(status_code=409, detail="Verification URL missing")
    if not _is_allowed_verification_url(verify_url):
        inbox.verification_status = "failed"
        inbox.verification_error = "Verification URL host is not allowed"
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
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    if inbox.verification_status not in {"action_required", "verified"}:
        raise HTTPException(status_code=409, detail="Verification action not available")

    inbox.verification_status = "verified"
    inbox.verification_error = None
    inbox.status = "active"
    inbox.verified_at = datetime.now(timezone.utc)
    await db.commit()

    # Sync status to integration_credentials
    await _sync_to_integration_credentials(
        db,
        inbox.org_id,
        inbox.inbox_address,
        inbox.provider,
        inbox.status,
    )
    await db.commit()

    return OrgInboxActionResponse(status="active", message="Inbox verified and active")


async def disconnect(db: AsyncSession, owner: IntegrationOwnerContext) -> None:
    inbox = await get_org_inbox(db, owner)
    if inbox is None:
        raise HTTPException(status_code=404, detail="No email integration configured")

    # Delete from both tables
    await db.delete(inbox)

    # Delete from integration_credentials
    result = await db.execute(select(Integration).where(Integration.slug == "email"))
    email_integration = result.scalar_one_or_none()
    if email_integration:
        cred_result = await db.execute(
            select(IntegrationCredential).where(
                IntegrationCredential.org_id == owner.org_id,
                IntegrationCredential.integration_id == email_integration.id,
            )
        )
        cred = cred_result.scalar_one_or_none()
        if cred:
            await db.delete(cred)

    await db.commit()


async def list_apps(
    db: AsyncSession, owner: IntegrationOwnerContext
) -> list[IntegrationAppDescriptor]:
    inbox = await get_org_inbox(db, owner)
    status = inbox.status if inbox is not None else "not_installed"
    installed = inbox is not None and inbox.status == "active"
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
    if inbox is None:
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
