from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.organization import OrgInboxActionResponse, OrgInboxResponse, UpsertOrgInboxRequest


class IntegrationAppDescriptor(BaseModel):
    app_id: str
    slug: str
    name: str
    category: str
    description: str
    status: str
    installed: bool


class IntegrationInstalledApp(BaseModel):
    app_id: str
    slug: str
    name: str
    status: str
    installed_at: datetime | None = None
    configured: bool


class IntegrationEmailConfigResponse(BaseModel):
    app_id: str = "email_integration"
    inbox: OrgInboxResponse | None = None
    configured: bool
    status: str


class IntegrationAppsResponse(BaseModel):
    items: list[IntegrationAppDescriptor]


class IntegrationInstalledAppsResponse(BaseModel):
    items: list[IntegrationInstalledApp]


class IntegrationEmailConfigUpsertRequest(UpsertOrgInboxRequest):
    pass


class IntegrationEmailConfigActionResponse(OrgInboxActionResponse):
    app_id: str = "email_integration"


class IntegrationOwnerContext(BaseModel):
    org_id: UUID
    role: str


class OutboundConfigResponse(BaseModel):
    id: str
    sending_domain: str | None = None
    from_email: str
    from_name: str | None = None
    status: str


class OutboundConfigUpsertRequest(BaseModel):
    sending_domain: str
    from_email: str
    from_name: str | None = None
