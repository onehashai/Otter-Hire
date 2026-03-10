from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class InboundWorkflowInput:
    bucket: str
    key: str


@dataclass
class OutboundWorkflowInput:
    """All data needed to send one outbound email and update its DB record."""

    org_id: str          # UUID as str
    message_id: str      # UUID as str — the Message row to update on success/failure
    to_email: str
    subject: str
    body: str
    html_body: str | None = None
    from_name: str | None = None
    in_reply_to: str | None = None       # raw Message-ID (no angle brackets)
    references: list[str] = field(default_factory=list)
