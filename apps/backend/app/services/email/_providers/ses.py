from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import logger
from app.services.email._base import ConversationSendResult, EmailProvider


class SesProvider(EmailProvider):
    """
    Platform-level SES: transactional mail uses SES_TRANSACTIONAL_FROM_* (default noreply@smartats.in).
    Conversation mail uses the same verified sender and sets the supplied
    reply+...@SES_MAIL_DOMAIN address as Reply-To.
    """

    @property
    def name(self) -> str:
        return "SES"

    def is_configured(self) -> bool:
        return bool(
            (settings.aws_ses_access_key or settings.aws_access_key_id or "").strip()
            and (settings.aws_ses_secret_key or settings.aws_secret_access_key or "").strip()
            and (settings.aws_ses_region or settings.aws_s3_region or "").strip()
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

        actual_from = settings.ses_effective_transactional_from_email.strip()
        if "@" not in actual_from:
            raise RuntimeError("SES_TRANSACTIONAL_FROM_EMAIL must be a valid email address")

        reply_to_addr = from_email.strip()
        if "@" not in reply_to_addr:
            raise RuntimeError("Conversation Reply-To must be a valid email address")

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
