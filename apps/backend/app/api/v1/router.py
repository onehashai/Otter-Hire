"""API v1 router — mounts internal and public under /v1."""

from fastapi import APIRouter

from app.api.v1.internal.router import internal_router
from app.api.v1.public.router import public_router

api_router = APIRouter(prefix="/v1", tags=["v1"])
api_router.include_router(internal_router)
api_router.include_router(public_router)
