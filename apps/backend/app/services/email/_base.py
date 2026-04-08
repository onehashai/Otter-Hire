from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ConversationSendResult:
    """
    Returned by every provider's send_conversation().

    provider_message_id — stored on Message.provider_message_id
                          format: "ses:<SES-MessageId>" or "zepto:<request_id>"
    email_message_id    — stored on Message.email_message_id; used as the
                          RFC 5322 Message-ID for threading in future replies
    """

    provider_message_id: str
    email_message_id: str


class EmailProvider(ABC):
    """Contract every platform-level email provider must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name used in log lines."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True when all required credentials are present in settings."""

    @abstractmethod
    async def send(
        self,
        *,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
    ) -> None:
        """Send one transactional email. Raises on failure."""

    @abstractmethod
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
    ) -> ConversationSendResult:
        """
        Send one outbound conversation / automation email.

        from_email / from_name  — org-specific sender, not from settings.
        in_reply_to / references — RFC 5322 threading headers.
        message_id_tag / org_id_tag — SES event-tracking only; providers that
                                       do not support tagging must ignore these.
        Raises on failure.
        """
