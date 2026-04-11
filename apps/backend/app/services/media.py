from __future__ import annotations

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_AVATAR_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
}
ALLOWED_PDF_TYPES = {"application/pdf"}


def _size_exceeded_detail(max_bytes: int) -> str:
    mb = max_bytes / (1024 * 1024)
    return f"File size must be <= {mb:g} MB"


async def read_avatar_upload_with_size_check(file: UploadFile) -> bytes:
    """User profile and organization logo uploads (`/me/avatar`)."""
    content = await file.read()
    max_b = settings.avatar_max_upload_bytes
    if len(content) > max_b:
        raise HTTPException(status_code=422, detail=_size_exceeded_detail(max_b))
    return content


async def read_upload_with_size_check(file: UploadFile) -> bytes:
    """Candidate document PDF upload (`/candidates/{id}/documents/upload`) — uses MAX_UPLOAD_BYTES."""
    content = await file.read()
    max_b = settings.max_upload_bytes
    if len(content) > max_b:
        raise HTTPException(status_code=422, detail=_size_exceeded_detail(max_b))
    return content


def ensure_avatar_type(content_type: str | None) -> None:
    if (content_type or "").lower() not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=422, detail="Only supported image types are allowed for avatar"
        )


def ensure_pdf_type(content_type: str | None) -> None:
    if (content_type or "").lower() not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=422, detail="Only PDF is allowed")
