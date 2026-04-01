from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logging import logger
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.conversation import Conversation
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.schemas.conversations import (
    CandidateSnippet,
    ConversationCreate,
    ConversationDetail,
    MessageCreate,
    MessageRead,
)
from app.temporal.email.queue import enqueue_outbound_email
from app.temporal.email.types import OutboundWorkflowInput
from app.utils.uuid import uuid7

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _reply_address_for_conversation(
    conv_id: UUID,
    *,
    fixed_domain: str | None = None,
    inbox_address: str | None = None,
) -> str | None:
    """Build reply+conv_id@domain so candidate replies land in this conversation."""
    domain: str | None = None
    if fixed_domain and fixed_domain.strip():
        domain = fixed_domain.strip().lower()
    if not domain and inbox_address and "@" in inbox_address:
        domain = inbox_address.strip().lower().split("@", 1)[1]
    if not domain:
        return None
    return f"reply+{conv_id}@{domain}"


def _message_to_read(msg: Message, sender_name: str | None = None) -> MessageRead:
    from app.utils.email_parse import parse_email_body

    body_visible: str | None = None
    body_quoted: str | None = None
    if msg.body:
        body_visible, body_quoted = parse_email_body(msg.body)

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
        body_visible=body_visible,
        body_quoted=body_quoted,
        html_body=msg.html_body,
        status=msg.status,
        provider_message_id=msg.provider_message_id,
        email_message_id=msg.email_message_id,
        in_reply_to=msg.in_reply_to,
        created_at=msg.created_at,
    )


def _conversation_to_detail(conv: Conversation) -> ConversationDetail:
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


async def _append_outbound_message(
    db: AsyncSession,
    conv: Conversation,
    current_user: User,
    body: MessageCreate,
    *,
    email_subject: str,
) -> MessageRead:
    """Persist outbound message and enqueue email send. Caller must load ``conv.candidate``."""
    if conv.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot send messages to an archived conversation",
        )

    org_name: str | None = None
    inbox_result = await db.execute(
        select(IntegrationCredential)
        .join(Integration, Integration.id == IntegrationCredential.integration_id)
        .where(
            IntegrationCredential.org_id == current_user.org_id,
            IntegrationCredential.job_id.is_(None),
            Integration.slug == "email",
        )
    )
    inbox = inbox_result.scalar_one_or_none()
    reply_to = _reply_address_for_conversation(
        conv.id,
        fixed_domain=settings.inbound_email_domain,
        inbox_address=(inbox.config or {}).get("inbound_address") if inbox else None,
    )
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    org = org_result.scalar_one_or_none()
    if org:
        org_name = org.name

    last_with_id_result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conv.id,
            Message.email_message_id.isnot(None),
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last_with_id = last_with_id_result.scalar_one_or_none()
    in_reply_to_msg_id: str | None = (
        (last_with_id.email_message_id or "").strip().strip("<>") or None
        if last_with_id and last_with_id.email_message_id
        else None
    )
    references_val: str | None = in_reply_to_msg_id if in_reply_to_msg_id else None

    from_email = reply_to or ""
    now = datetime.now(tz=timezone.utc)

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
        in_reply_to=in_reply_to_msg_id,
        created_at=now,
    )
    db.add(msg)

    conv.last_message_at = now
    if conv.status == "closed":
        conv.status = "open"

    await db.commit()
    await db.refresh(msg)

    try:
        await enqueue_outbound_email(
            OutboundWorkflowInput(
                org_id=str(current_user.org_id),
                message_id=str(msg_id),
                to_email=conv.candidate.email,
                subject=email_subject,
                body=body.body,
                html_body=body.html_body,
                from_name=current_user.name,
                org_name=org_name,
                reply_to=reply_to,
                in_reply_to=in_reply_to_msg_id,
                references=references_val,
            )
        )
    except Exception:
        logger.exception("Failed to enqueue outbound email workflow for message %s", msg_id)

    return _message_to_read(msg, sender_name=current_user.name)


async def _load_conversation_detail(
    db: AsyncSession, conversation_id: UUID, org_id: UUID
) -> ConversationDetail:
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.org_id == org_id,
        )
        .options(
            selectinload(Conversation.candidate),
            selectinload(Conversation.messages).selectinload(Message.sender_user),
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return _conversation_to_detail(conv)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/by-candidate/{candidate_id}", response_model=ConversationDetail)
async def get_conversation_by_candidate(
    candidate_id: UUID,
    current_user: User = Depends(require_permission("candidates:read")),
    db: AsyncSession = Depends(get_db),
):
    """Return the single conversation for this candidate in the org, or 404 if none."""
    cand_result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    if cand_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    conv_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.org_id == current_user.org_id,
            Conversation.candidate_id == candidate_id,
        )
        .options(
            selectinload(Conversation.candidate),
            selectinload(Conversation.messages).selectinload(Message.sender_user),
        )
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No conversation for this candidate",
        )

    return _conversation_to_detail(conv)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(require_permission("candidates:read")),
    db: AsyncSession = Depends(get_db),
):
    return await _load_conversation_detail(db, conversation_id, current_user.org_id)


@router.post("", response_model=ConversationDetail)
async def create_conversation(
    body: ConversationCreate,
    response: Response,
    current_user: User = Depends(require_permission("candidates:source")),
    db: AsyncSession = Depends(get_db),
):
    """Create the org's only conversation for this candidate, or append if it already exists."""
    cand_result = await db.execute(
        select(Candidate).where(
            Candidate.id == body.candidate_id,
            Candidate.org_id == current_user.org_id,
        )
    )
    candidate = cand_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    existing_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.org_id == current_user.org_id,
            Conversation.candidate_id == body.candidate_id,
        )
        .options(selectinload(Conversation.candidate))
    )
    existing = existing_result.scalar_one_or_none()

    if existing is not None:
        if body.job_id is not None and existing.job_id is None:
            existing.job_id = body.job_id
            await db.flush()
        msg_body = MessageCreate(body=body.body, html_body=body.html_body)
        await _append_outbound_message(
            db,
            existing,
            current_user,
            msg_body,
            email_subject=f"Re: {existing.subject}",
        )
        response.status_code = status.HTTP_200_OK
        return await _load_conversation_detail(db, existing.id, current_user.org_id)

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

    org_name: str | None = None
    inbox_result = await db.execute(
        select(IntegrationCredential)
        .join(Integration, Integration.id == IntegrationCredential.integration_id)
        .where(
            IntegrationCredential.org_id == current_user.org_id,
            IntegrationCredential.job_id.is_(None),
            Integration.slug == "email",
        )
    )
    inbox = inbox_result.scalar_one_or_none()
    reply_to = _reply_address_for_conversation(
        conv.id,
        fixed_domain=settings.inbound_email_domain,
        inbox_address=(inbox.config or {}).get("inbound_address") if inbox else None,
    )
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    org = org_result.scalar_one_or_none()
    if org:
        org_name = org.name

    from_email = reply_to or ""
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
                org_name=org_name,
                reply_to=reply_to,
            )
        )
    except Exception:
        logger.exception("Failed to enqueue outbound email workflow for message %s", msg_id)

    response.status_code = status.HTTP_201_CREATED
    return await _load_conversation_detail(db, conv.id, current_user.org_id)


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

    return await _append_outbound_message(
        db,
        conv,
        current_user,
        body,
        email_subject=f"Re: {conv.subject}",
    )


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

    return _conversation_to_detail(conv)
