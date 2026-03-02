import os
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import require_permission
from app.core.security import create_access_token
from app.db.session import get_db
from app.deps.auth import get_current_user, require_active_user
from app.models.job_category import JobCategory
from app.models.org_membership import OrgMembership
from app.models.organization import Organization, OrgInbox
from app.models.user import User
from app.schemas.organization import (
    CreateOrganizationRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
    OrgInboxActionResponse,
    OrgInboxResponse,
    SwitchOrganizationRequest,
    UpdateOrganizationRequest,
    UpsertOrgInboxRequest,
)
from app.services.media import ensure_avatar_type, read_upload_with_size_check
from app.services.storage import storage_service
from app.utils.uuid import uuid7

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _normalize_inbox_address(value: str) -> str:
    return value.strip().lower()


def _hash_secret(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _to_org_inbox_response(inbox: OrgInbox) -> OrgInboxResponse:
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


@router.patch("/me", response_model=OrganizationResponse)
async def update_my_organization(
    body: UpdateOrganizationRequest,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()

    organization.name = body.name
    organization.website = body.website

    await db.commit()
    await db.refresh(organization)

    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
    )


@router.get("/me", response_model=OrganizationResponse)
async def get_my_organization(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
    )


@router.post("/me/avatar", response_model=OrganizationResponse)
async def upload_my_organization_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_avatar_type(file.content_type)
    raw = await read_upload_with_size_check(file)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext:
        content_type = (file.content_type or "").lower()
        ext_map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/bmp": ".bmp",
            "image/tiff": ".tiff",
        }
        ext = ext_map.get(content_type, ".img")

    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()

    object_key = f"orgs/{current_user.org_id}/avatar/{current_user.org_id}_avatar{ext}"
    await storage_service.write_bytes(
        object_key, raw, (file.content_type or "application/octet-stream")
    )
    avatar_url = await storage_service.resolve_url(object_key)
    if organization.avatar_url and organization.avatar_url != avatar_url:
        await storage_service.delete_by_url(organization.avatar_url)
    organization.avatar_url = avatar_url
    await db.commit()
    await db.refresh(organization)

    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
    )


@router.delete("/me/avatar", response_model=OrganizationResponse)
async def delete_my_organization_avatar(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()
    if organization.avatar_url:
        await storage_service.delete_by_url(organization.avatar_url)
    organization.avatar_url = None
    await db.commit()
    await db.refresh(organization)
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=None,
    )


@router.get("/memberships", response_model=list[OrganizationMembershipResponse])
async def list_my_memberships(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrgMembership, Organization)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == "active",
        )
        .order_by(Organization.name.asc())
    )
    rows = result.all()
    return [
        OrganizationMembershipResponse(
            org_id=membership.org_id,
            org_name=org.name,
            org_website=org.website,
            role=membership.role,
            status=membership.status,
        )
        for membership, org in rows
    ]


@router.post("/switch", response_model=OrganizationMembershipResponse)
async def switch_organization(
    body: SwitchOrganizationRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership_result = await db.execute(
        select(OrgMembership, Organization)
        .join(Organization, OrgMembership.org_id == Organization.id)
        .where(
            OrgMembership.user_id == current_user.id,
            OrgMembership.org_id == body.org_id,
            OrgMembership.status == "active",
        )
    )
    row = membership_result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Active membership not found"
        )

    membership, organization = row
    token = create_access_token(
        {
            "user_id": str(current_user.id),
            "org_id": str(membership.org_id),
            "role": membership.role,
        }
    )
    _set_access_cookie(response, token)

    return OrganizationMembershipResponse(
        org_id=membership.org_id,
        org_name=organization.name,
        org_website=organization.website,
        role=membership.role,
        status=membership.status,
    )


@router.post("", response_model=OrganizationMembershipResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: CreateOrganizationRequest,
    response: Response,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    organization = Organization(name=body.name.strip())
    db.add(organization)
    await db.flush()

    for cat_name in ["Engineering", "Design", "Marketing", "Sales", "Data", "Operations", "HR"]:
        db.add(JobCategory(org_id=organization.id, name=cat_name, is_system_default=True))

    membership = OrgMembership(
        id=uuid7(),
        user_id=current_user.id,
        org_id=organization.id,
        role="owner",
        status="active",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(organization)
    await db.refresh(membership)

    token = create_access_token(
        {
            "user_id": str(current_user.id),
            "org_id": str(membership.org_id),
            "role": membership.role,
        }
    )
    _set_access_cookie(response, token)

    return OrganizationMembershipResponse(
        org_id=membership.org_id,
        org_name=organization.name,
        org_website=organization.website,
        role=membership.role,
        status=membership.status,
    )


@router.get("/me/inbox", response_model=OrgInboxResponse | None)
async def get_my_org_inbox(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
    if inbox is None:
        return None
    return _to_org_inbox_response(inbox)


@router.post("/me/inbox", response_model=OrgInboxResponse)
async def upsert_my_org_inbox(
    body: UpsertOrgInboxRequest,
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    normalized_address = _normalize_inbox_address(body.inbox_address)
    existing_by_address_result = await db.execute(
        select(OrgInbox).where(
            OrgInbox.inbox_address == normalized_address,
            OrgInbox.org_id != current_user.org_id,
        )
    )
    if existing_by_address_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Inbox address already configured")

    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
    if inbox is None:
        inbox = OrgInbox(
            org_id=current_user.org_id,
            inbox_address=normalized_address,
            provider=body.provider.strip().lower() or "ses",
            status="pending",
            verification_status="pending",
        )
        db.add(inbox)
    else:
        inbox.inbox_address = normalized_address
        inbox.provider = body.provider.strip().lower() or inbox.provider
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
    return _to_org_inbox_response(inbox)


@router.post("/me/inbox/rotate-secret", response_model=OrgInboxActionResponse)
async def rotate_my_org_inbox_secret(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
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


@router.post("/me/inbox/activate", response_model=OrgInboxActionResponse)
async def activate_my_org_inbox(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")

    if not inbox.secret_hash and settings.inbound_webhook_secret:
        inbox.secret_hash = settings.inbound_webhook_secret

    inbox.status = "active"
    inbox.verification_status = "verified"
    inbox.verification_error = None
    inbox.verified_at = datetime.now(timezone.utc)
    await db.commit()
    return OrgInboxActionResponse(status="active", message="Inbox is active")


@router.post("/me/inbox/verify-now", response_model=OrgInboxActionResponse)
async def verify_my_org_inbox_now(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
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


@router.post("/me/inbox/verify-complete", response_model=OrgInboxActionResponse)
async def mark_my_org_inbox_verification_complete(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == current_user.org_id))
    inbox = result.scalar_one_or_none()
    if inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")
    if inbox.verification_status not in {"action_required", "verified"}:
        raise HTTPException(status_code=409, detail="Verification action not available")

    inbox.verification_status = "verified"
    inbox.verification_error = None
    inbox.status = "active"
    inbox.verified_at = datetime.now(timezone.utc)
    await db.commit()
    return OrgInboxActionResponse(status="active", message="Inbox verified and active")
