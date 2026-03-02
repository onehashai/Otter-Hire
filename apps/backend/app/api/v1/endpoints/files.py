from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response

from app.core.config import settings
from app.deps.auth import require_active_user
from app.models.user import User
from app.services.storage import storage_service

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/local/{object_key:path}")
async def serve_local_file(
    object_key: str,
    current_user: User = Depends(require_active_user),
):
    org_prefix = f"orgs/{current_user.org_id}/"
    normalized_key = object_key.lstrip("/")
    if not normalized_key.startswith(org_prefix):
        raise HTTPException(status_code=403, detail="Forbidden")

    if settings.s3_enabled and storage_service.use_s3 and storage_service.s3_client:
        try:
            s3_response = storage_service.s3_client.get_object(
                Bucket=storage_service.bucket,
                Key=storage_service._s3_key(normalized_key),
            )
        except Exception:
            raise HTTPException(status_code=404, detail="File not found")

        content_type = s3_response.get("ContentType") or "application/octet-stream"
        content = s3_response["Body"].read()
        return Response(content=content, media_type=content_type)

    root = Path(settings.local_storage_root).resolve()
    full_path = (root / normalized_key).resolve()
    if not str(full_path).startswith(str(root)) or not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)
