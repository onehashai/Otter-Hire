from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.email._dispatch import send_email
from app.templates.email.candidate_note_mention import build_candidate_note_mention_email
from app.templates.email.invite import build_invite_email
from app.templates.email.password_reset import build_password_reset_email
from app.templates.email.verification import build_verification_email


async def send_verification_email(
    to_email: str,
    verify_url: str,
) -> None:
    content = build_verification_email(
        platform_name=settings.platform_name,
        expiry_hours=settings.verification_token_expire_hours,
        verify_url=verify_url,
    )
    await send_email(to_email, content, fallback_url=verify_url)


async def send_invite_email(
    to_email: str,
    invite_url: str,
    org_name: str,
    inviter_name: str,
) -> None:
    content = build_invite_email(
        invite_url=invite_url,
        platform_name=settings.platform_name,
        org_name=org_name,
        inviter_name=inviter_name,
        expiry_days=settings.invite_token_expire_days,
    )
    await send_email(to_email, content, fallback_url=invite_url)


async def send_password_reset_email(
    to_email: str,
    reset_url: str,
) -> None:
    content = build_password_reset_email(
        platform_name=settings.platform_name,
        expiry_hours=settings.password_reset_token_expire_hours,
        reset_url=reset_url,
    )
    await send_email(to_email, content, fallback_url=reset_url)


async def send_candidate_note_mention_email(
    *,
    to_email: str,
    recipient_name: str,
    author_name: str,
    candidate_name: str,
    candidate_url: str,
    note_excerpt: str,
    org_id: UUID | None = None,
    db: AsyncSession | None = None,
) -> None:
    content = build_candidate_note_mention_email(
        recipient_name=recipient_name,
        author_name=author_name,
        candidate_name=candidate_name,
        candidate_url=candidate_url,
        note_excerpt=note_excerpt,
    )
    await send_email(
        to_email,
        content,
        fallback_url=candidate_url,
        org_id=org_id,
        db=db,
    )
