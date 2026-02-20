from uuid import UUID
from pydantic import BaseModel, Field


class UpdateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str | None = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    website: str | None
