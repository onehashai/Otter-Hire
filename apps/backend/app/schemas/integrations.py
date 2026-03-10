from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

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


class OrgSmtpConfigResponse(BaseModel):
    id: str
    host: str
    port: int
    username: str
    password: str  # always masked as ••••••••
    from_email: str
    from_name: str | None = None
    use_tls: bool
    use_ssl: bool
    status: str
    last_test_at: str | None = None
    last_test_error: str | None = None


class OrgSmtpConfigUpsertRequest(BaseModel):
    host: str
    port: int = Field(default=587, ge=1, le=65535)
    username: str
    password: str | None = None
    from_email: str
    from_name: str | None = None
    use_tls: bool = True
    use_ssl: bool = False
