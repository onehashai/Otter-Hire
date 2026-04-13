from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.organization import Organization
from app.models.user import User
from app.services.storage import storage_service

router = APIRouter(prefix="/files", tags=["files"])


def _is_own_user_avatar_object_key(normalized_key: str, user_id: UUID) -> bool:
    """
    True if key matches orgs/{any_org}/users/{user_id}/avatar/... (user profile image).
    Allows the same user to load their avatar after switching org (upload used another org prefix).
    """
    if ".." in normalized_key:
        return False
    parts = normalized_key.split("/")
    # orgs / {org_id} / users / {user_id} / avatar / {filename}
    if len(parts) < 6:
        return False
    if parts[0] != "orgs" or parts[2] != "users" or parts[4] != "avatar":
        return False
    try:
        UUID(parts[1])
    except ValueError:
        return False
    return parts[3] == str(user_id)


def user_may_access_local_object_key(normalized_key: str, current_user: User) -> bool:
    """Authorization for GET /files/local/{object_key}."""
    if ".." in normalized_key:
        return False
    nk = normalized_key.lstrip("/")
    if current_user.org_id is not None:
        org_prefix = f"orgs/{current_user.org_id}/"
        if nk.startswith(org_prefix):
            return True
    return _is_own_user_avatar_object_key(nk, current_user.id)


def _object_key_from_stored_file_url(url: str) -> str | None:
    """Extract storage object key from URLs produced by storage_service.resolve_url."""
    clean = (url or "").strip()
    for prefix in ("/v1/internal/files/local/", "/api/files/local/", "/files/local/"):
        if clean.startswith(prefix):
            return clean[len(prefix) :].lstrip("/")
    return None


async def _stream_stored_object(normalized_key: str) -> Response | FileResponse:
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


@router.get("/local/{object_key:path}")
async def serve_local_file(
    object_key: str,
    current_user: User = Depends(require_active_user),
):
    normalized_key = object_key.lstrip("/")
    if not user_may_access_local_object_key(normalized_key, current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    return await _stream_stored_object(normalized_key)


@router.get("/public/org/{org_id}/avatar")
async def serve_public_org_avatar(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Serve organization logo for public careers pages (no auth)."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org or not org.avatar_url:
        raise HTTPException(status_code=404, detail="Avatar not found")

    normalized_key = _object_key_from_stored_file_url(org.avatar_url)
    if not normalized_key or not normalized_key.startswith(f"orgs/{org_id}/"):
        raise HTTPException(status_code=404, detail="Avatar not found")

    return await _stream_stored_object(normalized_key)
