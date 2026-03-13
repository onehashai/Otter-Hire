from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.session import get_db
from app.integrations.app_store.registry import all_integrations, get_integration_by_slug
from app.models.user import User
from app.integrations.app_store.email_integration import outbound_service
from app.schemas.integrations import (
    IntegrationAppsResponse,
    IntegrationEmailConfigActionResponse,
    IntegrationEmailConfigResponse,
    IntegrationEmailConfigUpsertRequest,
    IntegrationInstalledAppsResponse,
    IntegrationOwnerContext,
    OutboundConfigResponse,
    OutboundConfigUpsertRequest,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _owner_ctx(current_user: User) -> IntegrationOwnerContext:
    return IntegrationOwnerContext(org_id=current_user.org_id, role=current_user.role)


@router.get("/apps", response_model=IntegrationAppsResponse)
async def list_integration_apps(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    items = []
    for integration in all_integrations():
        items.extend(await integration.list_apps(db, _owner_ctx(current_user)))
    return IntegrationAppsResponse(items=items)


@router.get("/installed", response_model=IntegrationInstalledAppsResponse)
async def list_installed_integration_apps(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    items = []
    for integration in all_integrations():
        items.extend(await integration.list_installed(db, _owner_ctx(current_user)))
    return IntegrationInstalledAppsResponse(items=items)


@router.get("/email/config", response_model=IntegrationEmailConfigResponse)
async def get_email_integration_config(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "get_config"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.get_config(db, _owner_ctx(current_user))


@router.put("/email/config", response_model=IntegrationEmailConfigResponse)
async def upsert_email_integration_config(
    body: IntegrationEmailConfigUpsertRequest,
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "upsert_config"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.upsert_config(db, _owner_ctx(current_user), body)


@router.post("/email/rotate-secret", response_model=IntegrationEmailConfigActionResponse)
async def rotate_email_integration_secret(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "rotate_secret"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.rotate_secret(db, _owner_ctx(current_user))


@router.post("/email/activate", response_model=IntegrationEmailConfigActionResponse)
async def activate_email_integration(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "activate"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.activate(db, _owner_ctx(current_user))


@router.post("/email/verify-now", response_model=IntegrationEmailConfigActionResponse)
async def verify_email_integration_now(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "verify_now"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.verify_now(db, _owner_ctx(current_user))


@router.post("/email/verify-complete", response_model=IntegrationEmailConfigActionResponse)
async def verify_email_integration_complete(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    integration = get_integration_by_slug("email-integration")
    if integration is None or not hasattr(integration, "verify_complete"):
        raise HTTPException(status_code=404, detail="Integration not found")
    return await integration.verify_complete(db, _owner_ctx(current_user))


@router.post("/email/disconnect")
async def disconnect_email_integration(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    from app.integrations.app_store.email_integration import service as email_service

    await email_service.disconnect(db, _owner_ctx(current_user))
    return {"status": "disconnected", "message": "Email integration disconnected"}


# ---------------------------------------------------------------------------
# Outbound email (domain-only, SES)
# ---------------------------------------------------------------------------


@router.get("/email/outbound/config", response_model=OutboundConfigResponse | None)
async def get_outbound_config(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    return await outbound_service.get_outbound_config(db, _owner_ctx(current_user))


@router.put("/email/outbound/config", response_model=OutboundConfigResponse)
async def upsert_outbound_config(
    body: OutboundConfigUpsertRequest,
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    return await outbound_service.upsert_outbound_config(
        db,
        _owner_ctx(current_user),
        sending_domain=body.sending_domain,
        from_email=body.from_email,
        from_name=body.from_name,
    )


@router.delete("/email/outbound/config", status_code=204)
async def delete_outbound_config(
    current_user: User = Depends(require_permission("org:inbox:manage")),
    db: AsyncSession = Depends(get_db),
):
    await outbound_service.delete_outbound_config(db, _owner_ctx(current_user))
