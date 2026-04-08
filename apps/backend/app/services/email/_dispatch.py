from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.services.email._factory import get_platform_provider
from app.templates import EmailContent


async def send_email(
    to_email: str,
    content: EmailContent,
    *,
    fallback_url: str | None = None,
    org_id: UUID | None = None,
    db: AsyncSession | None = None,
) -> None:
    """
    Route one transactional email.

    Priority:
    1. Org-level SES — when the org has a verified outbound domain configured in DB.
       This path is preserved verbatim from the original email.py.
    2. Platform provider — ZeptoMail or SES, selected once by get_platform_provider().

    `fallback_url` is kept for signature compatibility but is no longer used
    (it was only needed for Mailtrap's console-print fallback which is now removed).
    """
    # --- Org-level SES routing (unchanged from original) ---
    if org_id is not None and db is not None:
        from app.integrations.app_store.email_integration.outbound_service import (
            get_verified_outbound_for_org,
        )
        from app.services.ses_outbound import send_email_via_ses

        outbound_row = await get_verified_outbound_for_org(db, org_id)
        from_email: str = ""
        from_name: str | None = None
        if outbound_row is not None:
            cfg = outbound_row.config or {}
            from_email = cfg.get("from_email", "")
            from_name = cfg.get("from_name")

        if from_email and "@" in from_email:
            send_email_via_ses(
                from_email=from_email,
                from_name=from_name,
                to_email=to_email,
                subject=content.subject,
                text_body=content.text,
                html_body=content.html,
            )
            logger.info("Email sent to %s via SES (org-level): %s", to_email, content.subject)
            return

    # --- Platform provider (ZeptoMail or SES) ---
    provider = get_platform_provider()
    await provider.send(
        to_email=to_email,
        subject=content.subject,
        html_body=content.html,
        text_body=content.text,
    )
