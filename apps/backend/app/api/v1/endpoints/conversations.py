from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import logger
from app.core.permissions import require_permission
from app.db.session import get_db
from app.integrations.app_store.email_integration.temporal.queue import enqueue_outbound_email
from app.integrations.app_store.email_integration.temporal.types import OutboundWorkflowInput
from app.models.candidate import Candidate
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.conversations import (
    CandidateSnippet,
    ConversationCreate,
    ConversationDetail,
    ConversationListItem,
    ConversationListResponse,
    MessageCreate,
    MessageRead,
)
from app.utils.uuid import uuid7

router = APIRouter(prefix="/conversations", tags=["conversations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _message_to_read(msg: Message, sender_name: str | None = None) -> MessageRead:
    return MessageRead(
        id=msg.id,
        conversation_id=msg.conversation_id,
        direction=msg.direction,
        sender_type=msg.sender_type,
        sender_user_id=msg.sender_user_id,
        sender_name=sender_name,
        from_email=msg.from_email,
        to_email=msg.to_email,
        body=msg.body,
        html_body=msg.html_body,
        status=msg.status,
        provider_message_id=msg.provider_message_id,
        email_message_id=msg.email_message_id,
        in_reply_to=msg.in_reply_to,
        created_at=msg.created_at,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(require_permission("candidates:read")),
    db: AsyncSession = Depends(get_db),
):
    org_id = current_user.org_id
    offset = (page - 1) * page_size

    total_result = await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.org_id == org_id)
    )
    total = total_result.scalar_one()

    convs_result = await db.execute(
        select(Conversation)
        .where(Conversation.org_id == org_id)
        .order_by(Conversation.last_message_at.desc().nullslast())
        .offset(offset)
        .limit(page_size)
        .options(selectinload(Conversation.candidate))
    )
    convs = convs_result.scalars().all()

    # Fetch last message body for each conversation in a single query
    conv_ids = [c.id for c in convs]
    last_msgs: dict[UUID, tuple[str, int]] = {}
    if conv_ids:
        subq = (
            select(
                Message.conversation_id,
                Message.body,
                func.row_number()
                .over(
                    partition_by=Message.conversation_id,
                    order_by=Message.created_at.desc(),
                )
                .label("rn"),
            )
            .where(Message.conversation_id.in_(conv_ids))
            .subquery()
        )
        rows = await db.execute(
            select(subq.c.conversation_id, subq.c.body).where(subq.c.rn == 1)
        )
        last_msgs = {row.conversation_id: row.body for row in rows}

        count_rows = await db.execute(
            select(Message.conversation_id, func.count().label("cnt"))
            .where(Message.conversation_id.in_(conv_ids))
            .group_by(Message.conversation_id)
        )
        msg_counts: dict[UUID, int] = {row.conversation_id: row.cnt for row in count_rows}
    else:
        msg_counts = {}

    items = [
        ConversationListItem(
            id=c.id,
            subject=c.subject,
            channel=c.channel,
            status=c.status,
            last_message_at=c.last_message_at,
            created_at=c.created_at,
            candidate=CandidateSnippet(
                id=c.candidate.id,
                name=c.candidate.name,
                email=c.candidate.email,
            ),
            last_message_body=last_msgs.get(c.id),
            message_count=msg_counts.get(c.id, 0),
        )
        for c in convs
    ]
    return ConversationListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(require_permission("candidates:read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.org_id == current_user.org_id,
        )
        .options(
            selectinload(Conversation.candidate),
            selectinload(Conversation.messages).selectinload(Message.sender_user),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    messages = [
        _message_to_read(
            msg,
            sender_name=msg.sender_user.name if msg.sender_user else None,
        )
        for msg in conv.messages
    ]

    return ConversationDetail(
        id=conv.id,
        subject=conv.subject,
        channel=conv.channel,
        status=conv.status,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        candidate=CandidateSnippet(
            id=conv.candidate.id,
            name=conv.candidate.name,
            email=conv.candidate.email,
        ),
        job_id=conv.job_id,
        messages=messages,
    )


@router.post("", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(require_permission("candidates:source")),
    db: AsyncSession = Depends(get_db),
):
    # Verify candidate belongs to this org
    cand_result = await db.execute(
        select(Candidate).where(
            Candidate.id == body.candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = cand_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    now = datetime.now(tz=timezone.utc)
    conv = Conversation(
        id=uuid7(),
        org_id=current_user.org_id,
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        subject=body.subject,
        channel="email",
        status="open",
        last_message_at=now,
    )
    db.add(conv)
    await db.flush()

    # Resolve from_email from SMTP config (lightweight DB lookup, no sending)
    try:
        from app.integrations.app_store.email_integration.smtp_service import (
            get_verified_smtp_for_org,
        )

        smtp_row = await get_verified_smtp_for_org(db, current_user.org_id)
        from_email = (smtp_row.config or {}).get("from_email", "") if smtp_row else ""
    except Exception:
        from_email = ""

    msg_id = uuid7()
    first_msg = Message(
        id=msg_id,
        org_id=current_user.org_id,
        conversation_id=conv.id,
        direction="outbound",
        sender_type="user",
        sender_user_id=current_user.id,
        from_email=from_email,
        to_email=candidate.email,
        body=body.body,
        html_body=body.html_body,
        status="queued",
        created_at=now,
    )
    db.add(first_msg)
    await db.commit()
    await db.refresh(conv)

    # Hand off actual sending to the Temporal worker (async, retriable)
    try:
        await enqueue_outbound_email(
            OutboundWorkflowInput(
                org_id=str(current_user.org_id),
                message_id=str(msg_id),
                to_email=candidate.email,
                subject=body.subject,
                body=body.body,
                html_body=body.html_body,
                from_name=current_user.name,
            )
        )
    except Exception:
        logger.exception("Failed to enqueue outbound email workflow for message %s", msg_id)

    return ConversationDetail(
        id=conv.id,
        subject=conv.subject,
        channel=conv.channel,
        status=conv.status,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        candidate=CandidateSnippet(
            id=candidate.id,
            name=candidate.name,
            email=candidate.email,
        ),
        job_id=conv.job_id,
        messages=[_message_to_read(first_msg, sender_name=current_user.name)],
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: UUID,
    body: MessageCreate,
    current_user: User = Depends(require_permission("candidates:source")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.org_id == current_user.org_id,
        )
        .options(selectinload(Conversation.candidate))
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    if conv.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot send messages to an archived conversation",
        )

    # Resolve from_email from SMTP config (lightweight DB lookup, no sending)
    try:
        from app.integrations.app_store.email_integration.smtp_service import (
            get_verified_smtp_for_org,
        )

        smtp_row = await get_verified_smtp_for_org(db, current_user.org_id)
        from_email = (smtp_row.config or {}).get("from_email", "") if smtp_row else ""
    except Exception:
        from_email = ""

    now = datetime.now(tz=timezone.utc)

    # Collect prior message IDs for email threading (In-Reply-To / References headers)
    prior_msgs_result = await db.execute(
        select(Message.email_message_id)
        .where(
            Message.conversation_id == conv.id,
            Message.email_message_id.is_not(None),
        )
        .order_by(Message.created_at.asc())
    )
    prior_ids = [r[0] for r in prior_msgs_result.all() if r[0]]
    in_reply_to_id = prior_ids[-1] if prior_ids else None

    msg_id = uuid7()
    msg = Message(
        id=msg_id,
        org_id=current_user.org_id,
        conversation_id=conv.id,
        direction="outbound",
        sender_type="user",
        sender_user_id=current_user.id,
        from_email=from_email,
        to_email=conv.candidate.email,
        body=body.body,
        html_body=body.html_body,
        status="queued",
        in_reply_to=in_reply_to_id,
        created_at=now,
    )
    db.add(msg)

    # Update conversation's last_message_at and reopen if closed
    conv.last_message_at = now
    if conv.status == "closed":
        conv.status = "open"

    await db.commit()
    await db.refresh(msg)

    # Hand off actual sending to the Temporal worker (async, retriable)
    try:
        await enqueue_outbound_email(
            OutboundWorkflowInput(
                org_id=str(current_user.org_id),
                message_id=str(msg_id),
                to_email=conv.candidate.email,
                subject=f"Re: {conv.subject}",
                body=body.body,
                html_body=body.html_body,
                from_name=current_user.name,
                in_reply_to=in_reply_to_id,
                references=prior_ids,
            )
        )
    except Exception:
        logger.exception("Failed to enqueue outbound email workflow for message %s", msg_id)

    return _message_to_read(msg, sender_name=current_user.name)


@router.patch("/{conversation_id}/status", response_model=ConversationDetail)
async def update_conversation_status(
    conversation_id: UUID,
    new_status: str = Query(..., pattern="^(open|closed|archived)$"),
    current_user: User = Depends(require_permission("candidates:source")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.org_id == current_user.org_id,
        )
        .options(
            selectinload(Conversation.candidate),
            selectinload(Conversation.messages).selectinload(Message.sender_user),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    conv.status = new_status
    await db.commit()
    await db.refresh(conv)

    messages = [
        _message_to_read(
            msg,
            sender_name=msg.sender_user.name if msg.sender_user else None,
        )
        for msg in conv.messages
    ]

    return ConversationDetail(
        id=conv.id,
        subject=conv.subject,
        channel=conv.channel,
        status=conv.status,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        candidate=CandidateSnippet(
            id=conv.candidate.id,
            name=conv.candidate.name,
            email=conv.candidate.email,
        ),
        job_id=conv.job_id,
        messages=messages,
    )
