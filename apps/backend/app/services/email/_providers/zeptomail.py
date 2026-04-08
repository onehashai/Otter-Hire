from __future__ import annotations

import uuid as _uuid_module

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.services.email._base import ConversationSendResult, EmailProvider


class ZeptoMailProvider(EmailProvider):
    """Sends transactional email via ZeptoMail REST API v1.1."""

    _API_URL = "https://api.zeptomail.com/v1.1/email"

    @property
    def name(self) -> str:
        return "ZeptoMail"

    def is_configured(self) -> bool:
        return bool(
            (settings.zeptomail_api_key or "").strip()
            and (settings.zeptomail_from_email or "").strip()
        )

    async def send(
        self,
        *,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        headers = {
            "Authorization": settings.zeptomail_api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "from": {
                "address": settings.zeptomail_from_email,
                "name": settings.zeptomail_from_name or settings.platform_name,
            },
            "to": [{"email_address": {"address": to_email}}],
            "subject": subject,
            "htmlbody": html_body,
            "textbody": text_body,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self._API_URL, json=payload, headers=headers)
            response.raise_for_status()

        logger.info("Email sent to %s via ZeptoMail: %s", to_email, subject)

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
        message_id_tag: str | None,  # SES-only concept — ignored here
        org_id_tag: str | None,  # SES-only concept — ignored here
    ) -> ConversationSendResult:
        # Generate an RFC 5322 Message-ID using the reply+ routing pattern so
        # inbound replies land back in the correct conversation.
        domain = (settings.inbound_email_domain or "inbound.smartats.in").strip()
        if message_id_tag:
            generated_mid = f"reply+{message_id_tag}@{domain}"
        else:
            generated_mid = f"reply+{_uuid_module.uuid4()}@{domain}"

        # Build mime_headers for threading
        mime_headers: list[dict[str, str]] = [
            {"header_name": "Message-ID", "header_value": f"<{generated_mid}>"},
        ]
        if in_reply_to:
            mid = in_reply_to.strip()
            if not (mid.startswith("<") and mid.endswith(">")):
                mid = f"<{mid}>"
            mime_headers.append({"header_name": "In-Reply-To", "header_value": mid})
        if references:
            refs = " ".join(
                r if (r.startswith("<") and r.endswith(">")) else f"<{r}>"
                for r in references.split()
                if r.strip()
            )
            if refs:
                mime_headers.append({"header_name": "References", "header_value": refs})

        headers = {
            "Authorization": settings.zeptomail_api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "from": {"address": from_email, "name": from_name or ""},
            "to": [{"email_address": {"address": to_email}}],
            "subject": subject,
            "textbody": text_body,
            "htmlbody": html_body or f"<p>{text_body}</p>",
            "mime_headers": mime_headers,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self._API_URL, json=payload, headers=headers)
            response.raise_for_status()

        request_id: str = response.json().get("request_id") or generated_mid

        logger.info(
            "Conversation email sent to %s via ZeptoMail: %s request_id=%s",
            to_email,
            subject,
            request_id,
        )
        return ConversationSendResult(
            provider_message_id=f"zepto:{request_id}",
            email_message_id=generated_mid,
        )
