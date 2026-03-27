"""
Action handlers for automation execution.

Each action type has a dedicated handler function.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.template import Template
from app.services.automation.template_renderer import build_template_context, render_template


async def handle_send_email_action(
    db: AsyncSession,
    action_config: dict,
    candidate_id: UUID,
    org_id: UUID,
    job_id: UUID | None,
    metadata: dict | None,
) -> tuple[bool, str]:
    """
    Handle send_email action.

    Sends automation email via Temporal worker (same as manual conversation messages).
    Creates or appends to conversation for unified thread.

    Args:
        db: Database session
        action_config: Action configuration (contains template_id)
        candidate_id: Candidate UUID
        org_id: Organization UUID
        job_id: Optional job UUID
        metadata: Optional trigger metadata

    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        from datetime import datetime, timezone

        from app.core.config import settings
        from app.temporal.email.queue import enqueue_outbound_email
        from app.temporal.email.types import OutboundWorkflowInput
        from app.models.candidate import Candidate
        from app.models.conversation import Conversation
        from app.models.message import Message
        from app.models.organization import Organization, OrgInbox
        from app.utils.uuid import uuid7

        # Extract template ID from config
        template_id_str = action_config.get("template")
        if not template_id_str:
            return False, "No template specified in action config"

        # Fetch template
        try:
            template_id = UUID(template_id_str)
        except (ValueError, TypeError):
            return False, f"Invalid template ID: {template_id_str}"

        template_stmt = select(Template).where(
            Template.id == template_id, Template.org_id == org_id
        )
        template_result = await db.execute(template_stmt)
        template = template_result.scalar_one_or_none()

        if not template:
            return False, f"Template {template_id} not found"

        # Build template context
        context = await build_template_context(
            db=db,
            candidate_id=candidate_id,
            org_id=org_id,
            job_id=job_id,
            metadata=metadata,
        )

        # Get recipient email from context
        recipient_email = context.get("candidate_email")
        if not recipient_email:
            return False, "Candidate has no email address"

        # Fetch candidate
        candidate_stmt = select(Candidate).where(Candidate.id == candidate_id)
        candidate_result = await db.execute(candidate_stmt)
        candidate = candidate_result.scalar_one_or_none()
        if not candidate:
            return False, "Candidate not found"

        # Render template
        rendered_subject = render_template(template.subject or "", context)
        rendered_body = render_template(template.body or "", context)

        # One canonical conversation per candidate (org-scoped); limit(1) safe before dedupe migration
        conv_stmt = (
            select(Conversation)
            .where(
                Conversation.org_id == org_id,
                Conversation.candidate_id == candidate_id,
            )
            .order_by(Conversation.last_message_at.desc().nullslast())
            .limit(1)
        )
        conv_result = await db.execute(conv_stmt)
        conversation = conv_result.scalar_one_or_none()

        now = datetime.now(tz=timezone.utc)

        if not conversation:
            # Create new conversation
            conversation = Conversation(
                id=uuid7(),
                org_id=org_id,
                candidate_id=candidate_id,
                job_id=job_id,
                subject=rendered_subject,
                channel="email",
                status="open",
                last_message_at=now,
            )
            db.add(conversation)
            await db.flush()
            logger.info(
                f"Automation created conversation: conv_id={conversation.id} candidate_id={candidate_id}"
            )
        else:
            # Update existing conversation
            conversation.last_message_at = now
            if conversation.status in ("closed", "archived"):
                conversation.status = "open"
            logger.info(
                f"Automation using existing conversation: conv_id={conversation.id} candidate_id={candidate_id}"
            )

        # Get org info
        org_stmt = select(Organization).where(Organization.id == org_id)
        org_result = await db.execute(org_stmt)
        org = org_result.scalar_one_or_none()
        org_name = org.name if org else None

        # Get inbox for reply-to address
        inbox_stmt = select(OrgInbox).where(OrgInbox.org_id == org_id)
        inbox_result = await db.execute(inbox_stmt)
        org_inbox = inbox_result.scalar_one_or_none()

        # Build reply-to address: reply+{conversation_id}@domain
        reply_to_address = None
        if settings.inbound_email_domain:
            reply_to_address = f"reply+{conversation.id}@{settings.inbound_email_domain}"
        elif org_inbox and org_inbox.inbox_address and "@" in org_inbox.inbox_address:
            domain = org_inbox.inbox_address.split("@")[1]
            reply_to_address = f"reply+{conversation.id}@{domain}"

        if not reply_to_address:
            return False, "No inbound email domain configured"

        # Create message record
        msg_id = uuid7()
        message = Message(
            id=msg_id,
            org_id=org_id,
            conversation_id=conversation.id,
            direction="outbound",
            sender_type="user",
            sender_user_id=None,
            from_email=reply_to_address,
            to_email=recipient_email,
            body=rendered_body,
            html_body=rendered_body,
            status="queued",
            created_at=now,
        )
        db.add(message)
        await db.commit()

        # Enqueue to Temporal worker for sending via SES (same as manual messages)
        try:
            await enqueue_outbound_email(
                OutboundWorkflowInput(
                    org_id=str(org_id),
                    message_id=str(msg_id),
                    to_email=recipient_email,
                    subject=rendered_subject,
                    body=rendered_body,
                    html_body=rendered_body,
                    from_name="OneHash ATS",
                    org_name=org_name,
                    reply_to=reply_to_address,
                )
            )
            logger.info(
                f"Automation email queued: message_id={msg_id} conv_id={conversation.id} to={recipient_email}"
            )
        except Exception as e:
            logger.error(f"Failed to enqueue automation email: {e}", exc_info=True)
            message.status = "failed"
            await db.commit()
            return False, f"Failed to enqueue email: {str(e)}"

        return True, f"Email sent to {recipient_email}"

    except Exception as e:
        error_msg = f"Failed to send automation email: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return False, error_msg


async def execute_action(
    db: AsyncSession,
    action: dict,
    candidate_id: UUID,
    org_id: UUID,
    job_id: UUID | None,
    metadata: dict | None,
) -> tuple[bool, str]:
    """
    Execute a single action.

    Routes to appropriate handler based on action type.

    Args:
        db: Database session
        action: Action dictionary with type and config
        candidate_id: Candidate UUID
        org_id: Organization UUID
        job_id: Optional job UUID
        metadata: Optional trigger metadata

    Returns:
        Tuple of (success: bool, message: str)
    """
    action_type = action.get("type")

    if action_type == "send_email":
        return await handle_send_email_action(
            db=db,
            action_config=action.get("config", {}),
            candidate_id=candidate_id,
            org_id=org_id,
            job_id=job_id,
            metadata=metadata,
        )
    else:
        return False, f"Unknown action type: {action_type}"
