from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings
from app.deps.auth import require_active_user
from app.models.user import User

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/local/{object_key:path}")
async def serve_local_file(
    object_key: str,
    current_user: User = Depends(require_active_user),
):
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not found")
    org_prefix = f"orgs/{current_user.org_id}/"
    normalized_key = object_key.lstrip("/")
    if not normalized_key.startswith(org_prefix):
        raise HTTPException(status_code=403, detail="Forbidden")
    root = Path(settings.local_storage_root).resolve()
    full_path = (root / normalized_key).resolve()
    if not str(full_path).startswith(str(root)) or not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)
