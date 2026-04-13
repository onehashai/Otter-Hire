"""Validation and path rules for public careers job application uploads.

Antivirus scanning is not performed here; use a perimeter scanner, async worker,
or object-store integrations if policy requires it.
"""

from __future__ import annotations

import re
import zipfile
from io import BytesIO
from urllib.parse import urlparse
from uuid import UUID


class PublicJobFileValidationError(ValueError):
    """Raised when upload bytes or metadata are not allowed."""


def public_job_upload_prefix(org_id: UUID, job_id: UUID) -> str:
    return f"orgs/{org_id}/job_applications/{job_id}/uploads/"


def file_ref_to_object_key(file_ref: str) -> str:
    """Normalize client file references to storage object keys."""
    raw = (file_ref or "").strip()
    if not raw:
        return ""

    candidate = raw
    parsed = urlparse(raw)
    if parsed.scheme and parsed.netloc:
        candidate = parsed.path or raw

    candidate = candidate.strip()
    for prefix in ("/v1/internal/files/local/", "/api/files/local/", "/files/local/"):
        if candidate.startswith(prefix):
            return candidate.removeprefix(prefix).lstrip("/")

    return candidate.lstrip("/")


def is_object_key_allowed_for_public_job(org_id: UUID, job_id: UUID, object_key: str) -> bool:
    prefix = public_job_upload_prefix(org_id, job_id)
    ok = (object_key or "").strip().startswith(prefix)
    if not ok:
        return False
    remainder = object_key[len(prefix) :]
    if ".." in remainder or remainder.startswith("/"):
        return False
    return True


def sanitize_upload_filename(filename: str, fallback_ext: str) -> str:
    base = (filename or "").strip().split("/")[-1].split("\\")[-1]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base)[:120]
    if not base or base in {".", ".."}:
        return f"upload{fallback_ext}"
    if "." not in base:
        return f"{base}{fallback_ext}"
    return base


def _is_pdf(content: bytes) -> bool:
    return len(content) >= 4 and content[:4] == b"%PDF"


def _is_docx(content: bytes) -> bool:
    if len(content) < 4 or content[:2] != b"PK":
        return False
    try:
        with zipfile.ZipFile(BytesIO(content)) as zf:
            names = zf.namelist()
            return any(n.startswith("word/") for n in names)
    except Exception:
        return False


def _is_plausible_utf8_text(content: bytes) -> bool:
    if len(content) > 2 * 1024 * 1024:
        return False
    try:
        content.decode("utf-8")
        return True
    except Exception:
        return False


def validate_upload_bytes(
    *,
    field_key: str,
    filename: str,
    content: bytes,
) -> tuple[str, str]:
    """
    Validate upload content and return (normalized_mime, safe_display_name).
    Raises PublicJobFileValidationError on failure.
    """
    if not content:
        raise PublicJobFileValidationError("Empty file")

    name = sanitize_upload_filename(filename, ".bin")
    ext = ""
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1].lower()

    if field_key == "resume":
        if ext not in {".pdf", ".docx"}:
            raise PublicJobFileValidationError("Resume must be a PDF or DOCX file")
        if _is_pdf(content):
            return "application/pdf", name
        if _is_docx(content):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name
        raise PublicJobFileValidationError("Resume file content does not match PDF or DOCX")

    if field_key == "cover_letter":
        if ext not in {".pdf", ".docx", ".txt"}:
            raise PublicJobFileValidationError("Cover letter must be PDF, DOCX, or TXT")
        if ext == ".txt":
            if not _is_plausible_utf8_text(content):
                raise PublicJobFileValidationError("Cover letter text file must be valid UTF-8")
            return "text/plain; charset=utf-8", name
        if _is_pdf(content):
            return "application/pdf", name
        if _is_docx(content):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name
        raise PublicJobFileValidationError("Cover letter file content does not match extension")

    # Custom file_upload fields: same as resume (documents only)
    if ext not in {".pdf", ".docx", ".txt"}:
        raise PublicJobFileValidationError("Allowed types: PDF, DOCX, or TXT")
    if ext == ".txt":
        if not _is_plausible_utf8_text(content):
            raise PublicJobFileValidationError("Text file must be valid UTF-8")
        return "text/plain; charset=utf-8", name
    if _is_pdf(content):
        return "application/pdf", name
    if _is_docx(content):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name
    raise PublicJobFileValidationError("File content does not match extension")
