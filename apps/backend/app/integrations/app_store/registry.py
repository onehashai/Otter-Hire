from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.app_store.email_integration import service as email_integration_service
from app.integrations.linkedin import service as linkedin_service
from app.schemas.integrations import (
    IntegrationAppDescriptor,
    IntegrationEmailConfigActionResponse,
    IntegrationEmailConfigResponse,
    IntegrationEmailConfigUpsertRequest,
    IntegrationInstalledApp,
    IntegrationOwnerContext,
)


@dataclass(frozen=True)
class AppStoreIntegration:
    app_id: str
    slug: str
    name: str
    category: str

    async def list_apps(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationAppDescriptor]:
        raise NotImplementedError

    async def list_installed(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationInstalledApp]:
        raise NotImplementedError


@dataclass(frozen=True)
class EmailIntegrationModule(AppStoreIntegration):
    app_id: str = email_integration_service.APP_ID
    slug: str = email_integration_service.APP_SLUG
    name: str = email_integration_service.APP_NAME
    category: str = "email"

    async def list_apps(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationAppDescriptor]:
        return await email_integration_service.list_apps(db, owner)

    async def list_installed(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationInstalledApp]:
        return await email_integration_service.list_installed_apps(db, owner)

    async def get_config(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> IntegrationEmailConfigResponse:
        return await email_integration_service.get_email_config(db, owner)

    async def upsert_config(
        self,
        db: AsyncSession,
        owner: IntegrationOwnerContext,
        body: IntegrationEmailConfigUpsertRequest,
    ) -> IntegrationEmailConfigResponse:
        await email_integration_service.upsert_email_config(db, owner, body)
        return await email_integration_service.get_email_config(db, owner)

    async def rotate_secret(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> IntegrationEmailConfigActionResponse:
        result = await email_integration_service.rotate_secret(db, owner)
        return IntegrationEmailConfigActionResponse(**result.model_dump())

    async def activate(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> IntegrationEmailConfigActionResponse:
        result = await email_integration_service.activate(db, owner)
        return IntegrationEmailConfigActionResponse(**result.model_dump())

    async def verify_now(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> IntegrationEmailConfigActionResponse:
        result = await email_integration_service.verify_now(db, owner)
        return IntegrationEmailConfigActionResponse(**result.model_dump())

    async def verify_complete(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> IntegrationEmailConfigActionResponse:
        result = await email_integration_service.verify_complete(db, owner)
        return IntegrationEmailConfigActionResponse(**result.model_dump())


@dataclass(frozen=True)
class LinkedInIntegrationModule(AppStoreIntegration):
    app_id: str = "linkedin"
    slug: str = "linkedin"
    name: str = "LinkedIn"
    category: str = "job_board"

    async def list_apps(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationAppDescriptor]:
        integration = await linkedin_service.get_linkedin_integration(db)
        if not integration:
            return []
        
        cred = await linkedin_service.get_linkedin_credential(db, owner.org_id)
        status = cred.status if cred else "not_installed"
        installed = cred is not None and cred.status == "active"
        
        return [
            IntegrationAppDescriptor(
                app_id=self.app_id,
                slug=self.slug,
                name=self.name,
                category=self.category,
                description="Post jobs and share content on LinkedIn",
                status=status,
                installed=installed,
            )
        ]

    async def list_installed(
        self, db: AsyncSession, owner: IntegrationOwnerContext
    ) -> list[IntegrationInstalledApp]:
        cred = await linkedin_service.get_linkedin_credential(db, owner.org_id)
        if not cred:
            return []
        
        return [
            IntegrationInstalledApp(
                app_id=self.app_id,
                slug=self.slug,
                name=self.name,
                status=cred.status,
                installed_at=cred.created_at,
                configured=True,
            )
        ]


INTEGRATIONS: tuple[AppStoreIntegration, ...] = (
    EmailIntegrationModule(),
    LinkedInIntegrationModule(),
)


def all_integrations() -> tuple[AppStoreIntegration, ...]:
    return INTEGRATIONS


def get_integration_by_slug(slug: str) -> AppStoreIntegration | None:
    for integration in INTEGRATIONS:
        if integration.slug == slug:
            return integration
    return None
