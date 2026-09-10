from __future__ import annotations

import hashlib
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.user import User
from app.schemas.canonical import ImportRowError
from app.services.csv_service import parse_csv, stream_candidates
from app.services.import_export_service import import_candidates

router = APIRouter(prefix="/import-export", tags=["import-export"])


def _enabled() -> None:
    if not settings.ats_auto_import_enabled:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Data migration is disabled")


@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...), job_id: UUID | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("data_migration:import")),
):
    _enabled()
    mapping, rows, parse_errors = parse_csv(await file.read())
    if job_id:
        rows = [row.model_copy(update={"job_id": job_id}) for row in rows]
    summary = await import_candidates(db, user.org_id, rows, "csv")
    summary.errors.extend(ImportRowError(row=error["row"], message=error["message"]) for error in parse_errors)
    summary.failed += len(parse_errors)
    return {"mapping": mapping, **summary.model_dump()}


@router.get("/export/candidates")
async def export_candidates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("data_migration:export")),
):
    _enabled()
    return StreamingResponse(stream_candidates(db, user.org_id), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=candidates.csv"
    })


@router.post("/api-keys")
async def create_api_key(
    name: str = "Local integration",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("data_migration:manage")),
):
    _enabled()
    raw_key = "sk_live_" + secrets.token_urlsafe(32)
    db.add(ApiKey(org_id=user.org_id, name=name[:120], key_prefix=raw_key[:16], key_hash=hashlib.sha256(raw_key.encode()).hexdigest()))
    await db.commit()
    return {"key": raw_key, "warning": "Store this key now; it cannot be shown again."}


@router.get("/api-keys")
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("data_migration:manage")),
):
    _enabled()
    keys = (await db.execute(select(ApiKey).where(ApiKey.org_id == user.org_id).order_by(ApiKey.created_at.desc()))).scalars()
    return {"items": [{"id": key.id, "name": key.name, "prefix": key.key_prefix, "active": key.is_active, "created_at": key.created_at} for key in keys]}
