import base64
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.email import InboundEmail
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.admin import (
    ALLOWED_ORG_ROLES_FOR_ADMIN_UPDATE,
    AdminOrganizationRow,
    AdminUpdateMembershipRequest,
    AdminUserMembershipRow,
)
from app.schemas.email_logs import AdminEmailLogRow
from app.services.storage import storage_service

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_platform_admin(
    current_user: User = Depends(require_active_user),
) -> User:
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required",
        )
    return current_user


@router.get("/users", response_model=list[AdminUserMembershipRow])
async def list_all_user_memberships(
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, OrgMembership, Organization)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .join(Organization, Organization.id == OrgMembership.org_id)
        .order_by(Organization.name.asc(), User.email.asc())
    )
    rows = result.all()
    return [
        AdminUserMembershipRow(
            membership_id=membership.id,
            user_id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            product_role=user.role,
            organization_role=membership.role,
            org_id=organization.id,
            org_name=organization.name,
            status=membership.status,
            last_active_at=user.updated_at,
        )
        for user, membership, organization in rows
    ]


@router.patch("/memberships/{membership_id}", response_model=AdminUserMembershipRow)
async def update_membership(
    membership_id: UUID,
    body: AdminUpdateMembershipRequest,
    current_user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update user identity, platform role, and/or this org membership (not organization transfer)."""
    result = await db.execute(
        select(User, OrgMembership, Organization)
        .join(OrgMembership, OrgMembership.user_id == User.id)
        .join(Organization, Organization.id == OrgMembership.org_id)
        .where(OrgMembership.id == membership_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    user, membership, organization = row

    if body.name is not None:
        user.name = body.name

    if body.email is not None and body.email != user.email:
        dup = await db.execute(select(User.id).where(User.email == body.email, User.id != user.id))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )
        user.email = body.email

    if body.product_role is not None and body.product_role != user.role:
        if body.product_role == "user" and user.role == "admin":
            admin_count = (
                await db.execute(select(func.count()).select_from(User).where(User.role == "admin"))
            ).scalar_one()
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last platform administrator",
                )
        user.role = body.product_role

    if body.organization_role is not None and body.organization_role != membership.role:
        if membership.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change organization role for an owner",
            )
        if body.organization_role not in ALLOWED_ORG_ROLES_FOR_ADMIN_UPDATE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid organization role",
            )
        membership.role = body.organization_role

    if body.status is not None and body.status != membership.status:
        if membership.role == "owner" and body.status == "declined":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot disable an organization owner",
            )
        membership.status = body.status

    await db.commit()
    await db.refresh(user)
    await db.refresh(membership)

    return AdminUserMembershipRow(
        membership_id=membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        product_role=user.role,
        organization_role=membership.role,
        org_id=organization.id,
        org_name=organization.name,
        status=membership.status,
        last_active_at=user.updated_at,
    )


@router.get("/organizations", response_model=list[AdminOrganizationRow])
async def list_all_organizations(
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    member_counts = (
        select(
            OrgMembership.org_id.label("org_id"),
            func.count(OrgMembership.id).label("cnt"),
        )
        .where(OrgMembership.status.in_(("active", "pending")))
        .group_by(OrgMembership.org_id)
    ).subquery()

    result = await db.execute(
        select(Organization, func.coalesce(member_counts.c.cnt, 0).label("member_count"))
        .outerjoin(member_counts, member_counts.c.org_id == Organization.id)
        .order_by(Organization.name.asc())
    )
    rows = result.all()
    return [
        AdminOrganizationRow(
            id=org.id,
            name=org.name,
            website=org.website,
            member_count=int(cnt or 0),
            created_at=org.created_at,
        )
        for org, cnt in rows
    ]


@router.get("/email-logs", response_model=list[AdminEmailLogRow])
async def list_admin_email_logs(
    org_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sender: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    q = (
        select(InboundEmail, Organization.name.label("org_name"))
        .join(Organization, Organization.id == InboundEmail.org_id)
        .where(InboundEmail.received_at >= cutoff)
        .order_by(InboundEmail.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if org_id:
        q = q.where(InboundEmail.org_id == org_id)
    if status_filter:
        q = q.where(InboundEmail.parse_status == status_filter)
    if sender:
        q = q.where(InboundEmail.from_email.ilike(f"%{sender}%"))
    if date_from:
        q = q.where(InboundEmail.received_at >= date_from)
    if date_to:
        q = q.where(InboundEmail.received_at <= date_to)

    rows = (await db.execute(q)).all()
    return [
        AdminEmailLogRow(
            id=r.InboundEmail.id,
            received_at=r.InboundEmail.received_at,
            from_email=r.InboundEmail.from_email,
            from_name=r.InboundEmail.from_name,
            subject=r.InboundEmail.subject,
            parse_status=r.InboundEmail.parse_status,
            parse_error=r.InboundEmail.parse_error,
            has_resume_attachment=r.InboundEmail.has_resume_attachment,
            attachment_count=r.InboundEmail.attachment_count,
            attachment_primary_filename=r.InboundEmail.attachment_primary_filename,
            parsed_candidate_id=r.InboundEmail.parsed_candidate_id,
            parse_duration_ms=r.InboundEmail.parse_duration_ms,
            inbox_address=r.InboundEmail.inbox_address,
            created_at=r.InboundEmail.created_at,
            org_id=r.InboundEmail.org_id,
            org_name=r.org_name,
        )
        for r in rows
    ]


@router.get("/email-logs/{email_id}/body")
async def get_admin_email_log_body(
    email_id: UUID,
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    inbound_email = (
        await db.execute(select(InboundEmail).where(InboundEmail.id == email_id))
    ).scalar_one_or_none()

    if not inbound_email:
        raise HTTPException(status_code=404, detail="Email log not found")

    if not inbound_email.raw_storage_key:
        return {"text_body": "No raw email stored.", "html_body": ""}

    try:
        from app.integrations.app_store.email_integration.ses_bridge import (
            _extract_text_and_attachments,
        )
        from app.services.storage import storage_service

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
                    "download_url": f"/v1/internal/admin/email-logs/{email_id}/attachments/{idx}",
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
async def download_admin_email_log_attachment(
    email_id: UUID,
    index: int,
    current_user: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    inbound_email = (
        await db.execute(
            select(InboundEmail).where(InboundEmail.id == email_id)
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




