import base64
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.deps.auth import get_current_user, require_active_user
from app.models.email import InboundEmail
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.email_logs import EmailLogRow
from app.schemas.organization import (
    CreateOrganizationRequest,
    OrganizationMembershipResponse,
    OrganizationResponse,
    SwitchOrganizationRequest,
    UpdateOrganizationLanguageRequest,
    UpdateOrganizationRequest,
)
from app.services.default_categories import create_default_job_categories_for_org
from app.services.default_email_templates import create_default_templates_for_org
from app.services.media import ensure_avatar_type, read_avatar_upload_with_size_check
from app.services.storage import storage_service
from app.utils.uuid import uuid7

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _set_access_cookie(response: Response, token: str) -> None:
    cookie_params = {
        "key": "access_token",
        "value": token,
        "httponly": True,
        "samesite": "none",
        "secure": True,
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
        jobs_page_language=organization.jobs_page_language or "en",
    )


@router.patch("/me/language", response_model=OrganizationResponse)
async def update_my_organization_language(
    body: UpdateOrganizationLanguageRequest,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()
    organization.jobs_page_language = body.jobs_page_language
    await db.commit()
    await db.refresh(organization)
    org_hex = organization.id.hex
    domain = settings.SES_MAIL_DOMAIN or "smartats.in"
    catch_all_email = f"org-{org_hex}@{domain}"
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
        jobs_page_language=organization.jobs_page_language,
        catch_all_email=catch_all_email,
    )


@router.get("/me", response_model=OrganizationResponse)
async def get_my_organization(
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.org_id))
    organization = result.scalar_one()
    org_hex = organization.id.hex
    domain = settings.SES_MAIL_DOMAIN or "smartats.in"
    catch_all_email = f"org-{org_hex}@{domain}"
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
        jobs_page_language=organization.jobs_page_language or "en",
        catch_all_email=catch_all_email,
    )


@router.post("/me/avatar", response_model=OrganizationResponse)
async def upload_my_organization_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_avatar_type(file.content_type)
    raw = await read_avatar_upload_with_size_check(file)
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

    org_hex = organization.id.hex
    domain = settings.SES_MAIL_DOMAIN or "smartats.in"
    catch_all_email = f"org-{org_hex}@{domain}"
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        website=organization.website,
        avatar_url=organization.avatar_url,
        jobs_page_language=organization.jobs_page_language or "en",
        catch_all_email=catch_all_email,
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
        jobs_page_language=organization.jobs_page_language or "en",
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
            "membership_role": membership.role,
            "account_role": current_user.role,
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

    create_default_job_categories_for_org(db, organization.id)
    create_default_templates_for_org(db, organization.id)

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
            "membership_role": membership.role,
            "account_role": current_user.role,
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


@router.get("/email-logs", response_model=list[EmailLogRow])
async def list_org_email_logs(
    status_filter: str | None = Query(None, alias="status"),
    sender: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.membership_role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    q = (
        select(InboundEmail)
        .where(
            InboundEmail.org_id == current_user.org_id,
            InboundEmail.received_at >= cutoff,
        )
        .order_by(InboundEmail.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status_filter:
        q = q.where(InboundEmail.parse_status == status_filter)
    if sender:
        q = q.where(InboundEmail.from_email.ilike(f"%{sender}%"))
    if date_from:
        q = q.where(InboundEmail.received_at >= date_from)
    if date_to:
        q = q.where(InboundEmail.received_at <= date_to)

    rows = (await db.execute(q)).scalars().all()
    return [
        EmailLogRow(
            id=r.id,
            received_at=r.received_at,
            from_email=r.from_email,
            from_name=r.from_name,
            subject=r.subject,
            parse_status=r.parse_status,
            parse_error=r.parse_error,
            has_resume_attachment=r.has_resume_attachment,
            attachment_count=r.attachment_count,
            attachment_primary_filename=r.attachment_primary_filename,
            parsed_candidate_id=r.parsed_candidate_id,
            parse_duration_ms=r.parse_duration_ms,
            inbox_address=r.inbox_address,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/email-logs/{email_id}/body")
async def get_org_email_log_body(
    email_id: UUID,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.membership_role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    inbound_email = (
        await db.execute(
            select(InboundEmail).where(
                InboundEmail.id == email_id,
                InboundEmail.org_id == current_user.org_id,
            )
        )
    ).scalar_one_or_none()

    if not inbound_email:
        raise HTTPException(status_code=404, detail="Email log not found")

    if not inbound_email.raw_storage_key:
        return {"text_body": "No raw email stored.", "html_body": ""}

    try:
        from app.integrations.app_store.email_integration.ses_bridge import (
            _extract_text_and_attachments,
        )

        try:
            raw_email = await storage_service.read_bytes(inbound_email.raw_storage_key)
        except Exception:
            # Try alternate key variations (e.g. without leading prefix or with stag prefix)
            alt_key = inbound_email.raw_storage_key
            raw_email = None
            if "/" in alt_key:
                unprefixed = alt_key.split("/", 1)[1]
                for try_key in [unprefixed, f"otter-hire-stag/{unprefixed}", f"otter-hire-prod/{unprefixed}"]:
                    try:
                        raw_email = await storage_service.read_bytes(try_key)
                        if raw_email:
                            break
                    except Exception:
                        continue
            if not raw_email:
                raise

        extracted = _extract_text_and_attachments(raw_email)
        raw_atts = extracted.get("attachments") or []
        parsed_atts = []
        for idx, a in enumerate(raw_atts):
            if not isinstance(a, dict):
                continue
            b64 = a.get("content_base64")
            raw_bytes = base64.b64decode(b64) if b64 else (a.get("content") or b"")
            parsed_atts.append(
                {
                    "index": idx,
                    "filename": a.get("filename") or "attachment.bin",
                    "content_type": a.get("content_type") or "application/octet-stream",
                    "size_bytes": len(raw_bytes),
                    "download_url": f"/v1/internal/organizations/email-logs/{email_id}/attachments/{idx}",
                }
            )
        if inbound_email.parsed_candidate_id:
            try:
                from app.models.document import CandidateDocument
                c_docs = (
                    await db.execute(
                        select(CandidateDocument).where(
                            CandidateDocument.candidate_id == inbound_email.parsed_candidate_id,
                            CandidateDocument.is_deleted.is_(False),
                        )
                    )
                ).scalars().all()
                for cd in c_docs:
                    if not any(a.get("filename") == cd.name for a in parsed_atts):
                        parsed_atts.append(
                            {
                                "index": len(parsed_atts),
                                "filename": cd.name,
                                "content_type": cd.mime_type or "application/pdf",
                                "size_bytes": cd.size_bytes,
                                "download_url": cd.url,
                            }
                        )
            except Exception:
                pass

        return {
            "text_body": extracted.get("text_body") or "",
            "html_body": extracted.get("html_body") or "",
            "attachments": parsed_atts,
        }
    except Exception:
        # Fallback to stored database Message if raw S3 payload is unavailable
        try:
            from sqlalchemy import func

            from app.models.conversation import Conversation
            from app.models.document import CandidateDocument
            from app.models.message import Message

            db_msg = None
            clean_msg_id = (inbound_email.message_id or "").strip().strip("<>")
            if clean_msg_id:
                db_msg = (
                    await db.execute(
                        select(Message).where(
                            func.replace(func.replace(Message.email_message_id, "<", ""), ">", "")
                            == clean_msg_id
                        )
                    )
                ).scalars().first()

            if not db_msg and inbound_email.parsed_candidate_id:
                db_msg = (
                    await db.execute(
                        select(Message)
                        .join(Conversation, Message.conversation_id == Conversation.id)
                        .where(Conversation.candidate_id == inbound_email.parsed_candidate_id)
                        .order_by(Message.created_at.asc())
                        .limit(1)
                    )
                ).scalars().first()

            fallback_atts = []
            if inbound_email.parsed_candidate_id:
                c_docs = (
                    await db.execute(
                        select(CandidateDocument).where(
                            CandidateDocument.candidate_id == inbound_email.parsed_candidate_id,
                            CandidateDocument.is_deleted.is_(False),
                        )
                    )
                ).scalars().all()
                for cd in c_docs:
                    fallback_atts.append(
                        {
                            "index": len(fallback_atts),
                            "filename": cd.name,
                            "content_type": cd.mime_type or "application/pdf",
                            "size_bytes": cd.size_bytes,
                            "download_url": cd.url,
                        }
                    )

            if db_msg:
                return {
                    "text_body": db_msg.body or "",
                    "html_body": db_msg.html_body or "",
                    "attachments": fallback_atts or db_msg.attachments or [],
                }
            elif fallback_atts:
                return {
                    "text_body": "(Raw email payload not available for this entry)",
                    "html_body": "",
                    "attachments": fallback_atts,
                }
        except Exception:
            pass

        return {
            "text_body": "(Raw email payload not available for this entry)",
            "html_body": "",
            "attachments": [],
        }


@router.get("/email-logs/{email_id}/attachments/{index}")
async def download_org_email_log_attachment(
    email_id: UUID,
    index: int,
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.membership_role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    inbound_email = (
        await db.execute(
            select(InboundEmail).where(
                InboundEmail.id == email_id,
                InboundEmail.org_id == current_user.org_id,
            )
        )
    ).scalar_one_or_none()

    if not inbound_email or not inbound_email.raw_storage_key:
        raise HTTPException(status_code=404, detail="Attachment not found")

    try:
        from app.integrations.app_store.email_integration.ses_bridge import (
            _extract_text_and_attachments,
        )

        try:
            raw_email = await storage_service.read_bytes(inbound_email.raw_storage_key)
        except Exception:
            alt_key = inbound_email.raw_storage_key
            raw_email = None
            if "/" in alt_key:
                unprefixed = alt_key.split("/", 1)[1]
                for try_key in [unprefixed, f"otter-hire-stag/{unprefixed}", f"otter-hire-prod/{unprefixed}"]:
                    try:
                        raw_email = await storage_service.read_bytes(try_key)
                        if raw_email:
                            break
                    except Exception:
                        continue
            if not raw_email:
                raise

        extracted = _extract_text_and_attachments(raw_email)
        atts = extracted.get("attachments") or []

        if index < 0 or index >= len(atts):
            raise HTTPException(status_code=404, detail="Attachment index out of range")

        att = atts[index]
        filename = att.get("filename") or "attachment.bin"
        b64 = att.get("content_base64")
        content = base64.b64decode(b64) if b64 else (att.get("content") or b"")
        content_type = att.get("content_type") or "application/octet-stream"

        return Response(
            content=content,
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not load attachment: {e}")





