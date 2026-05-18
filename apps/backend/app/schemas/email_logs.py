from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EmailLogRow(BaseModel):
    id: UUID
    received_at: datetime
    from_email: str | None = None
    from_name: str | None = None
    subject: str | None = None
    parse_status: str
    parse_error: str | None = None
    has_resume_attachment: bool
    attachment_count: int
    attachment_primary_filename: str | None = None
    parsed_candidate_id: UUID | None = None
    parse_duration_ms: int | None = None
    inbox_address: str
    created_at: datetime


class AdminEmailLogRow(EmailLogRow):
    org_id: UUID
    org_name: str
