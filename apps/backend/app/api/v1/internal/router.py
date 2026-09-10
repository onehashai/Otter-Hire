"""Internal API router — all routes require JWT/session auth. Used by frontend."""

from fastapi import APIRouter, Depends

from app.api.v1.internal.endpoints.admin import router as admin_router
from app.api.v1.internal.endpoints.ats_migrations import router as ats_migrations_router
from app.api.v1.internal.endpoints.auth import router as auth_router
from app.api.v1.internal.endpoints.automations import router as automations_router
from app.api.v1.internal.endpoints.candidates import router as candidates_router
from app.api.v1.internal.endpoints.conversations import router as conversations_router
from app.api.v1.internal.endpoints.files import router as files_router
from app.api.v1.internal.endpoints.import_export import router as import_export_router
from app.api.v1.internal.endpoints.integrations import router as integrations_router
from app.api.v1.internal.endpoints.job_categories import router as job_categories_router
from app.api.v1.internal.endpoints.jobs import router as jobs_router
from app.api.v1.internal.endpoints.linkedin import router as linkedin_router
from app.api.v1.internal.endpoints.mcp_keys import router as mcp_keys_router
from app.api.v1.internal.endpoints.migrations import router as migrations_router
from app.api.v1.internal.endpoints.organizations import router as organizations_router
from app.api.v1.internal.endpoints.public import router as public_router
from app.api.v1.internal.endpoints.reports import router as reports_router
from app.api.v1.internal.endpoints.templates import router as templates_router
from app.api.v1.internal.endpoints.users import router as users_router
from app.api.v1.internal.endpoints.webhooks import router as webhooks_router
from app.middleware.context import RequestContext, get_request_context
from app.schemas.common import HealthResponse, RequestContextSchema

internal_router = APIRouter(prefix="/internal", tags=["internal"])


@internal_router.get("/health", response_model=HealthResponse)
async def internal_health():
    return HealthResponse(status="ok")


@internal_router.get("/me", response_model=RequestContextSchema)
async def get_me(ctx: RequestContext = Depends(get_request_context)):
    return ctx.to_schema()


internal_router.include_router(auth_router)
internal_router.include_router(admin_router)
internal_router.include_router(jobs_router)
internal_router.include_router(users_router)
internal_router.include_router(organizations_router)
internal_router.include_router(templates_router)
internal_router.include_router(automations_router)
internal_router.include_router(job_categories_router)
internal_router.include_router(candidates_router)
internal_router.include_router(conversations_router)
internal_router.include_router(files_router)
internal_router.include_router(integrations_router)
internal_router.include_router(import_export_router)
internal_router.include_router(linkedin_router)
internal_router.include_router(migrations_router)
internal_router.include_router(ats_migrations_router)
internal_router.include_router(mcp_keys_router)
internal_router.include_router(reports_router)
internal_router.include_router(public_router, tags=["public"])
internal_router.include_router(webhooks_router)
