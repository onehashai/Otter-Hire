"""Public API router — API key auth. For external integrations (to be implemented)."""

from fastapi import APIRouter

public_router = APIRouter(prefix="/public", tags=["public-api"])

# API key dependency will be added later
# All routes here will require X-API-Key or Authorization: Bearer <api_key>


@public_router.get("/health")
async def public_health():
    """Health check for public API (no auth required for this endpoint)."""
    return {"status": "ok", "api": "public"}
