from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import logger
from app.services.email._base import ConversationSendResult, EmailProvider


class SesProvider(EmailProvider):
    """
    Platform-level SES: transactional mail uses SES_TRANSACTIONAL_FROM_* (default noreply@smartats.in).
    Conversation mail uses send_conversation(from_email=...) — typically reply+...@SES_MAIL_DOMAIN.
    """

    @property
    def name(self) -> str:
        return "SES"

    def is_configured(self) -> bool:
        return bool(
            (settings.aws_access_key_id or "").strip()
            and (settings.aws_secret_access_key or "").strip()
            and (settings.aws_s3_region or "").strip()
            and (settings.ses_effective_transactional_from_email or "").strip()
        )

    async def send(
        self,
        *,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        from app.services.ses_outbound import send_email_via_ses

        await asyncio.to_thread(
            send_email_via_ses,
            from_email=settings.ses_effective_transactional_from_email,
            from_name=settings.ses_effective_transactional_from_name or settings.platform_name,
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )

        logger.info("Email sent to %s via SES (platform): %s", to_email, subject)

    async def send_conversation(
        self,
        *,
        from_email: str,
        from_name: str | None,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str | None,
        in_reply_to: str | None,
        references: str | None,
        message_id_tag: str | None,
        org_id_tag: str | None,
        attachments: list[dict] | None = None,
    ) -> ConversationSendResult:
        from app.services.ses_outbound import send_email_via_ses

        # Use the verified environment-specific domain for SES identity authorization.
        mail_domain = (settings.SES_MAIL_DOMAIN or "").strip().lstrip("@")
        if not mail_domain:
            raise RuntimeError("SES_MAIL_DOMAIN is required for conversation email")
        if "smartats.in" in mail_domain:
            actual_from = "noreply@applications.otter.bz"
        else:
            actual_from = f"noreply@{mail_domain}"
        reply_to_addr = from_email

        ses_id: str = await asyncio.to_thread(
            send_email_via_ses,
            from_email=actual_from,
            from_name=from_name,
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            reply_to=reply_to_addr,
            in_reply_to=in_reply_to,
            references=references,
            message_id_tag=message_id_tag,
            org_id_tag=org_id_tag,
            attachments=attachments,
        )

        logger.info(
            "Conversation email sent to %s via SES: %s ses_id=%s",
            to_email,
            subject,
            ses_id,
        )
        return ConversationSendResult(
            provider_message_id=f"ses:{ses_id}",
            email_message_id=ses_id,
        )
