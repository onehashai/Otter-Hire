from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.internal.endpoints.admin import require_platform_admin
from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.email import InboundEmail
from app.models.organization import Organization
from app.models.user import User
from app.schemas.email_logs import (
    AdminEmailLogPageResponse,
    AdminEmailLogRow,
    EmailLogPageResponse,
    EmailLogRow,
)

router = APIRouter(tags=["email-logs"])


def _email_log_row(email: InboundEmail) -> EmailLogRow:
    return EmailLogRow(
        id=email.id,
        received_at=email.received_at,
        from_email=email.from_email,
        from_name=email.from_name,
        subject=email.subject,
        parse_status=email.parse_status,
        parse_error=email.parse_error,
        has_resume_attachment=email.has_resume_attachment,
        attachment_count=email.attachment_count,
        attachment_primary_filename=email.attachment_primary_filename,
        parsed_candidate_id=email.parsed_candidate_id,
        parse_duration_ms=email.parse_duration_ms,
        inbox_address=email.inbox_address,
        created_at=email.created_at,
    )


@router.get("/organizations/email-logs/paginated", response_model=EmailLogPageResponse)
async def list_org_email_logs_paginated(
    status_filter: str | None = Query(None, alias="status"),
    sender: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.membership_role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    filters = [
        InboundEmail.org_id == current_user.org_id,
        InboundEmail.received_at >= cutoff,
    ]
    if status_filter:
        filters.append(InboundEmail.parse_status == status_filter)
    if sender:
        filters.append(InboundEmail.from_email.ilike(f"%{sender}%"))
    if date_from:
        filters.append(InboundEmail.received_at >= date_from)
    if date_to:
        filters.append(InboundEmail.received_at <= date_to)

    rows = (
        await db.execute(
            select(InboundEmail)
            .where(*filters)
            .order_by(InboundEmail.received_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    total = int(
        (await db.execute(select(func.count(InboundEmail.id)).where(*filters))).scalar_one() or 0
    )
    return EmailLogPageResponse(
        items=[_email_log_row(email) for email in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/admin/email-logs/paginated", response_model=AdminEmailLogPageResponse)
async def list_admin_email_logs_paginated(
    org_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sender: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: User = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    filters = [InboundEmail.received_at >= cutoff]
    if org_id:
        filters.append(InboundEmail.org_id == org_id)
    if status_filter:
        filters.append(InboundEmail.parse_status == status_filter)
    if sender:
        filters.append(InboundEmail.from_email.ilike(f"%{sender}%"))
    if date_from:
        filters.append(InboundEmail.received_at >= date_from)
    if date_to:
        filters.append(InboundEmail.received_at <= date_to)

    rows = (
        await db.execute(
            select(InboundEmail, Organization.name.label("org_name"))
            .join(Organization, Organization.id == InboundEmail.org_id)
            .where(*filters)
            .order_by(InboundEmail.received_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    total = int(
        (
            await db.execute(
                select(func.count(InboundEmail.id))
                .join(Organization, Organization.id == InboundEmail.org_id)
                .where(*filters)
            )
        ).scalar_one()
        or 0
    )
    return AdminEmailLogPageResponse(
        items=[
            AdminEmailLogRow(
                **_email_log_row(row.InboundEmail).model_dump(),
                org_id=row.InboundEmail.org_id,
                org_name=row.org_name,
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
