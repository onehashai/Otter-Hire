from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.candidates import router as candidates_router
from app.api.v1.endpoints.conversations import router as conversations_router
from app.api.v1.endpoints.files import router as files_router
from app.api.v1.endpoints.integrations import router as integrations_router
from app.api.v1.endpoints.job_categories import router as job_categories_router
from app.api.v1.endpoints.jobs import router as jobs_router
from app.api.v1.endpoints.organizations import router as organizations_router
from app.api.v1.endpoints.public import router as public_router
from app.api.v1.endpoints.track import router as track_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.webhooks import router as webhooks_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(jobs_router)
api_router.include_router(users_router)
api_router.include_router(organizations_router)
api_router.include_router(job_categories_router)
api_router.include_router(candidates_router)
api_router.include_router(conversations_router)
api_router.include_router(files_router)
api_router.include_router(integrations_router)
api_router.include_router(public_router, prefix="/public", tags=["public"])
api_router.include_router(track_router, prefix="/public", tags=["tracking"])
api_router.include_router(webhooks_router)
