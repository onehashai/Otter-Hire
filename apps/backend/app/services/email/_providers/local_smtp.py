from __future__ import annotations

import asyncio
import smtplib
import uuid
from email.message import EmailMessage

from app.core.config import settings
from app.services.email._base import ConversationSendResult, EmailProvider


class LocalSmtpProvider(EmailProvider):
    """Local-only SMTP provider for Mailpit; never selected in production."""

    @property
    def name(self) -> str:
        return "Local SMTP"

    def is_configured(self) -> bool:
        return not settings.is_production and bool(settings.local_smtp_host)

    def _message(self, *, from_email: str, from_name: str | None, to_email: str, subject: str,
                 text_body: str, html_body: str | None, in_reply_to: str | None,
                 references: str | None, message_id: str, attachments: list[dict] | None = None) -> EmailMessage:
        message = EmailMessage()
        message["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        message["To"] = to_email
        message["Subject"] = subject
        message["Message-ID"] = f"<{message_id}>"
        if in_reply_to:
            message["In-Reply-To"] = in_reply_to if in_reply_to.startswith("<") else f"<{in_reply_to}>"
        if references:
            message["References"] = references
        message.set_content(text_body)
        if html_body:
            message.add_alternative(html_body, subtype="html")
        for attachment in attachments or []:
            message.add_attachment(attachment["content"], maintype="application", subtype="octet-stream", filename=attachment.get("filename", "attachment"))
        return message

    def _send(self, message: EmailMessage) -> None:
        with smtplib.SMTP(settings.local_smtp_host, settings.local_smtp_port, timeout=10) as smtp:
            smtp.send_message(message)

    async def send(self, *, to_email: str, subject: str, html_body: str, text_body: str) -> None:
        message = self._message(from_email=settings.local_smtp_from, from_name=settings.platform_name,
                                to_email=to_email, subject=subject, text_body=text_body,
                                html_body=html_body, in_reply_to=None, references=None,
                                message_id=f"local-{uuid.uuid4()}@localhost")
        await asyncio.to_thread(self._send, message)

    async def send_conversation(self, *, from_email: str, from_name: str | None, to_email: str,
                                subject: str, text_body: str, html_body: str | None,
                                in_reply_to: str | None, references: str | None,
                                message_id_tag: str | None, org_id_tag: str | None,
                                attachments: list[dict] | None = None) -> ConversationSendResult:
        message_id = f"{message_id_tag or uuid.uuid4()}@localhost"
        message = self._message(from_email=from_email or settings.local_smtp_from, from_name=from_name,
                                to_email=to_email, subject=subject, text_body=text_body,
                                html_body=html_body, in_reply_to=in_reply_to, references=references,
                                message_id=message_id, attachments=attachments)
        await asyncio.to_thread(self._send, message)
        return ConversationSendResult(provider_message_id=f"local:{message_id}", email_message_id=message_id)
