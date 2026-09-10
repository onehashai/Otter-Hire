from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.services.migration.config_loader import load_connector_registry
from app.services.migration.orchestrator import job_status, start_migration

router = APIRouter(prefix="/migrations", tags=["migrations"])
CONFIG_DIR = Path(__file__).resolve().parents[3] / "migration_configs"


def _enabled() -> None:
    if not settings.ats_auto_import_enabled:
        raise HTTPException(status_code=404, detail="ATS auto-import is disabled")


class MigrationStartRequest(BaseModel):
    connector_id: str = Field(min_length=1, max_length=120)
    source_secret: str | None = None


@router.get("/connectors")
async def list_connectors(_: User = Depends(require_permission("data_migration:import"))):
    _enabled()
    registry = load_connector_registry(CONFIG_DIR)
    return {"items": [{"id": item.id, "name": item.name} for item in registry.values()]}


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start(
    body: MigrationStartRequest,
    user: User = Depends(require_permission("data_migration:import")),
):
    _enabled()
    if settings.is_production:
        raise HTTPException(status_code=403, detail="Connector migrations are disabled in this environment")
    config = load_connector_registry(CONFIG_DIR).get(body.connector_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Unknown migration connector")
    return await start_migration(AsyncSessionLocal, user.org_id, config, body.source_secret)


@router.get("/{job_id}")
async def status_view(job_id: str, _: User = Depends(require_permission("data_migration:import"))):
    _enabled()
    result = job_status(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Migration job not found")
    return result
