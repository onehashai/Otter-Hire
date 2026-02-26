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
