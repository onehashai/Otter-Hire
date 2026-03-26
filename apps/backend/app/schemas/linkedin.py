"""LinkedIn integration schemas."""

from pydantic import BaseModel


class CompleteLinkedInSetupRequest(BaseModel):
    """Request body for completing LinkedIn setup."""

    organization_id: str
    organization_name: str
    organization_vanity_name: str = ""
    organization_logo_url: str | None = None
