from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UpdateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str | None = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    website: str | None
    avatar_url: str | None = None


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
    inbox_address: str = Field(min_length=3, max_length=320)
    provider: str = Field(default="ses", min_length=2, max_length=32)


class OrgInboxActionResponse(BaseModel):
    status: str
    message: str
    action_url: str | None = None
