from fastapi import APIRouter

from app.api.v1.external.candidates import router as candidates_router

external_router = APIRouter(prefix="/external", tags=["external-api"])
external_router.include_router(candidates_router)
