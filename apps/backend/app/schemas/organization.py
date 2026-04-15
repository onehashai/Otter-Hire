from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validators import normalize_email

SUPPORTED_JOBS_PAGE_LANGUAGES = ("en", "es", "fr", "de", "pt", "browser")


class UpdateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str | None = None


class UpdateOrganizationLanguageRequest(BaseModel):
    jobs_page_language: str

    @field_validator("jobs_page_language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in SUPPORTED_JOBS_PAGE_LANGUAGES:
            raise ValueError(
                f"Unsupported language. Must be one of: {SUPPORTED_JOBS_PAGE_LANGUAGES}"
            )
        return v


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    website: str | None
    avatar_url: str | None = None
    jobs_page_language: str = "en"


class OrganizationMembershipResponse(BaseModel):
    org_id: UUID
    org_name: str
    org_website: str | None
    role: str
    status: str


class SwitchOrganizationRequest(BaseModel):
    org_id: UUID


class CreateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class OrgInboxResponse(BaseModel):
    id: UUID
    org_id: UUID
    inbox_address: str
    provider: str
    status: str
    verification_status: str = "pending"
    verification_provider: str | None = None
    verification_action_type: str | None = None
    verification_action_url: str | None = None
    verification_detected_at: datetime | None = None
    verification_error: str | None = None
    verified_at: datetime | None = None
    verification_expires_at: datetime | None = None


class UpsertOrgInboxRequest(BaseModel):
    inbox_address: EmailStr
    provider: str = Field(default="ses", min_length=2, max_length=32)

    @field_validator("inbox_address")
    @classmethod
    def validate_inbox_address(cls, value: EmailStr) -> str:
        return normalize_email(value)


class OrgInboxActionResponse(BaseModel):
    status: str
    message: str
    action_url: str | None = None
