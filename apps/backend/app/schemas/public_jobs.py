from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class PublicJobListItem(BaseModel):
    id: str
    title: str
    description: str | None
    category: str | None
    employment_type: str | None
    workplace_type: str | None
    location: str | None
    salary_min: int | None
    salary_max: int | None
    salary_fixed: int | None
    currency: str
    salary_timeframe: str
    published_at: datetime
    status: str

    class Config:
        from_attributes = True


class PublicJobDetail(BaseModel):
    id: str
    title: str
    description: str | None
    category: str | None
    employment_type: str | None
    workplace_type: str | None
    country: str | None
    city: str | None
    salary_min: int | None
    salary_max: int | None
    salary_fixed: int | None
    currency: str
    salary_timeframe: str
    published_at: datetime
    org_name: str
    status: str
    application_form_schema: dict[str, Any] = {}

    class Config:
        from_attributes = True


class PublicJobApplyRequest(BaseModel):
    full_name: str | None = None
    email: str
    phone: str | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    files: dict[str, Any] | None = None
    # Backward-compatible aliases used by older clients.
    name: str | None = None
    responses: dict[str, Any] | None = None
    cover_letter: str | None = None
    resume_url: str | None = None

    @model_validator(mode="after")
    def normalize_legacy_fields(self) -> "PublicJobApplyRequest":
        if not self.full_name and self.name:
            self.full_name = self.name

        if self.responses and not self.answers:
            self.answers = dict(self.responses)

        if self.cover_letter and "cover_letter" not in self.answers:
            self.answers["cover_letter"] = self.cover_letter

        if self.resume_url:
            normalized_files = dict(self.files or {})
            normalized_files.setdefault("resume", self.resume_url)
            self.files = normalized_files

        if not self.full_name or not self.full_name.strip():
            raise ValueError("full_name is required")

        return self


class PublicJobApplyResponse(BaseModel):
    id: str
    status: str


class InboundAttachmentPayload(BaseModel):
    filename: str
    content_type: str
    content_base64: str


class InboundEmailPayload(BaseModel):
    inbox_address: str
    from_email: str | None = None
    from_name: str | None = None
    subject: str | None = None
    message_id: str | None = None
    received_at: datetime | None = None
    raw_storage_key: str | None = None
    raw_email_base64: str | None = None
    text_body: str | None = None
    html_body: str | None = None
    attachments: list[InboundAttachmentPayload] = Field(default_factory=list)
