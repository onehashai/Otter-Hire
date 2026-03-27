from __future__ import annotations

from dataclasses import dataclass


@dataclass
class InboundWorkflowInput:
    bucket: str
    key: str


@dataclass
class OutboundWorkflowInput:
    """All data needed to send one outbound email and update its DB record."""

    org_id: str
    message_id: str
    to_email: str
    subject: str
    body: str
    html_body: str | None = None
    from_name: str | None = None
    org_name: str | None = None
    reply_to: str | None = None
    in_reply_to: str | None = None  # Message-ID of the email we're replying to (for threading)
    references: str | None = None  # Space-separated Message-IDs for thread (References header)
