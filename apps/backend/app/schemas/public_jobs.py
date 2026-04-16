from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.validators import is_valid_phone, normalize_email, normalize_phone


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


class PublicJobsListResponse(BaseModel):
    jobs: list[PublicJobListItem]
    org_name: str
    org_avatar_url: str | None = None
    jobs_page_language: str = "en"


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
    org_avatar_url: str | None = None
    status: str
    application_form_schema: dict[str, Any] = {}
    jobs_page_language: str = "en"

    class Config:
        from_attributes = True


class PublicJobApplyRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr
    phone: str | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    files: dict[str, Any] | None = None
    # Backward-compatible aliases used by older clients.
    name: str | None = None
    responses: dict[str, Any] | None = None
    cover_letter: str | None = None
    resume_url: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        normalized = normalize_phone(value)
        if normalized is None:
            return None
        if not is_valid_phone(normalized):
            raise ValueError("Invalid phone number format")
        return normalized

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


class PublicApplyFileUploadResponse(BaseModel):
    key: str
    name: str
    content_type: str | None = None
    size_bytes: int
    url: str


class InboundAttachmentPayload(BaseModel):
    filename: str
    content_type: str
    content_base64: str


class InboundEmailPayload(BaseModel):
    inbox_address: EmailStr
    reply_to_conversation_id: str | None = None  # when To: reply+<conv_id>@...
    from_email: EmailStr | None = None
    from_name: str | None = None
    subject: str | None = None
    message_id: str | None = None
    in_reply_to: str | None = None
    references: str | None = None
    auto_submitted: str | None = None
    list_unsubscribe: bool = False
    precedence: str | None = None
    x_auto_response_suppress: str | None = None
    received_at: datetime | None = None
    raw_storage_key: str | None = None
    raw_email_base64: str | None = None
    text_body: str | None = None
    html_body: str | None = None
    attachments: list[InboundAttachmentPayload] = Field(default_factory=list)

    @field_validator("inbox_address")
    @classmethod
    def validate_inbox_address(cls, value: EmailStr) -> str:
        return normalize_email(value)

    @field_validator("from_email")
    @classmethod
    def validate_from_email(cls, value: EmailStr | None) -> str | None:
        if value is None:
            return None
        return normalize_email(value)
