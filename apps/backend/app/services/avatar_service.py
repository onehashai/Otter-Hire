"""Best-effort candidate avatar and profile enrichment.

The resolver deliberately persists every accepted image in object storage.  It
never exposes an external avatar URL on a candidate record and failures are
contained to this service so they cannot block candidate ingestion.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import PurePosixPath
from time import monotonic
from urllib.parse import quote, urlparse
from uuid import UUID, uuid4

import fitz
import httpx
from PIL import Image, ImageOps
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.services.resume.extractors.document_text import extract_document
from app.services.resume.heuristics import normalize_phone_with_country
from app.services.resume.hyperlinks import extract_best_links, extract_linkedin_url_from_text
from app.services.storage import storage_service

logger = logging.getLogger("ats_worker")

_MIN_IMAGE_DIMENSION = 100
_MAX_IMAGE_BYTES = 12 * 1024 * 1024
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
_AVATAR_NAME_RE = re.compile(r"(?:photo|headshot|profile|avatar)", re.IGNORECASE)
_PUBLIC_AVATAR_MIN_INTERVAL_SECONDS = 2.0
_DEFAULT_RATE_LIMIT_RETRY_SECONDS = 15 * 60
_MAX_RATE_LIMIT_RETRY_SECONDS = 60 * 60
_public_avatar_request_lock = asyncio.Lock()
_next_public_avatar_request_at = 0.0


@dataclass(frozen=True)
class AvatarDownloadResult:
    image: bytes | None
    state: str
    error: str | None = None
    retry_after_seconds: int = 0


def _normalise_image(data: bytes) -> bytes | None:
    """Validate and convert a source image to a compact, non-animated JPEG."""
    if not data or len(data) > _MAX_IMAGE_BYTES:
        return None
    try:
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            width, height = image.size
            if width < _MIN_IMAGE_DIMENSION or height < _MIN_IMAGE_DIMENSION:
                return None
            image.thumbnail((768, 768), Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="JPEG", quality=88, optimize=True)
            return output.getvalue()
    except Exception:
        return None


def _portrait_score(data: bytes) -> int:
    try:
        with Image.open(BytesIO(data)) as image:
            width, height = image.size
    except Exception:
        return -1
    if width < _MIN_IMAGE_DIMENSION or height < _MIN_IMAGE_DIMENSION:
        return -1
    ratio = width / height
    if ratio < 0.45 or ratio > 1.7:
        return -1
    # A portrait/square image is more likely to be a headshot than a logo.
    return min(width * height, 4_000_000) + int((1.25 - abs(1 - ratio)) * 100_000)


def _best_pdf_headshot(data: bytes) -> bytes | None:
    try:
        document = fitz.open(stream=data, filetype="pdf")
        if not document.page_count:
            return None
        candidates: list[tuple[int, bytes]] = []
        for image_meta in document[0].get_images(full=True):
            extracted = document.extract_image(image_meta[0])
            image_data = extracted.get("image", b"")
            score = _portrait_score(image_data)
            if score >= 0:
                candidates.append((score, image_data))
        return max(candidates, default=(-1, None), key=lambda row: row[0])[1]
    except Exception:
        return None


def _best_docx_headshot(data: bytes) -> bytes | None:
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            candidates: list[tuple[int, bytes]] = []
            for name in archive.namelist():
                if not name.startswith("word/media/"):
                    continue
                image_data = archive.read(name)
                score = _portrait_score(image_data)
                if score >= 0:
                    candidates.append((score, image_data))
            return max(candidates, default=(-1, None), key=lambda row: row[0])[1]
    except (OSError, zipfile.BadZipFile, KeyError):
        return None


def _best_legacy_doc_headshot(data: bytes) -> bytes | None:
    """Recover contiguous JPEG or PNG payloads embedded in legacy Word files.

    Binary .doc files are OLE containers rather than ZIP archives. Their embedded
    images are commonly stored as complete image streams, so this deliberately
    conservative scan supports those files without treating arbitrary document
    bytes as an avatar.
    """
    candidates: list[tuple[int, bytes]] = []
    cursor = 0
    while True:
        start = data.find(b"\xff\xd8\xff", cursor)
        if start < 0:
            break
        end = data.find(b"\xff\xd9", start + 3)
        if end < 0:
            break
        image_data = data[start : end + 2]
        score = _portrait_score(image_data)
        if score >= 0:
            candidates.append((score, image_data))
        cursor = end + 2

    png_signature = b"\x89PNG\r\n\x1a\n"
    cursor = 0
    while True:
        start = data.find(png_signature, cursor)
        if start < 0:
            break
        end = data.find(b"IEND\xaeB`\x82", start + len(png_signature))
        if end < 0:
            break
        image_data = data[start : end + 8]
        score = _portrait_score(image_data)
        if score >= 0:
            candidates.append((score, image_data))
        cursor = end + 8

    return max(candidates, default=(-1, None), key=lambda row: row[0])[1]


def _image_resume_header_crop(data: bytes) -> bytes | None:
    """Extract the conventional top-left header portrait from an image CV."""
    try:
        with Image.open(BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            width, height = image.size
            if width < 300 or height < 300:
                return None
            side = min(width // 3, height // 2)
            if side < _MIN_IMAGE_DIMENSION:
                return None
            crop = image.crop((0, 0, side, side))
            output = BytesIO()
            crop.save(output, format="JPEG", quality=88, optimize=True)
            return output.getvalue()
    except Exception:
        return None


def _linkedin_username(linkedin_url: str | None) -> str | None:
    if not linkedin_url:
        return None
    parsed = urlparse(linkedin_url.strip())
    if parsed.hostname not in {"linkedin.com", "www.linkedin.com"}:
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) != 2 or parts[0].lower() != "in":
        return None
    username = parts[1]
    return username if re.fullmatch(r"[A-Za-z0-9_-]{2,100}", username) else None


async def _wait_for_public_avatar_slot(url: str) -> None:
    """Serialize unavatar requests so a backfill cannot burst its quota."""
    global _next_public_avatar_request_at
    if (urlparse(url).hostname or "").lower() != "unavatar.io":
        return
    async with _public_avatar_request_lock:
        now = monotonic()
        wait_seconds = max(0.0, _next_public_avatar_request_at - now)
        _next_public_avatar_request_at = max(now, _next_public_avatar_request_at) + _PUBLIC_AVATAR_MIN_INTERVAL_SECONDS
    if wait_seconds:
        await asyncio.sleep(wait_seconds)


def _retry_after_seconds(response: httpx.Response) -> int:
    value = (response.headers.get("retry-after") or "").strip()
    try:
        seconds = int(value)
    except ValueError:
        seconds = _DEFAULT_RATE_LIMIT_RETRY_SECONDS
    return max(1, min(seconds, _MAX_RATE_LIMIT_RETRY_SECONDS))


async def _download_avatar_image(url: str) -> AvatarDownloadResult:
    await _wait_for_public_avatar_slot(url)
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
            response = await client.get(url, headers={"User-Agent": "OtterHireAvatarResolver/1.0"})
            if response.status_code == httpx.codes.TOO_MANY_REQUESTS:
                return AvatarDownloadResult(
                    image=None,
                    state="rate_limited",
                    error="Public avatar provider rate limited the request",
                    retry_after_seconds=_retry_after_seconds(response),
                )
            if response.status_code != httpx.codes.OK:
                return AvatarDownloadResult(image=None, state="not_found")
            if len(response.content) > _MAX_IMAGE_BYTES:
                return AvatarDownloadResult(
                    image=None,
                    state="failed",
                    error="Avatar provider returned an oversized image",
                )
            image = _normalise_image(response.content)
            return AvatarDownloadResult(
                image=image,
                state="found" if image else "not_found",
            )
    except httpx.HTTPError as exc:
        logger.info(
            "Public avatar lookup failed host=%s error=%s",
            urlparse(url).hostname,
            type(exc).__name__,
        )
        return AvatarDownloadResult(
            image=None,
            state="failed",
            error="Public avatar provider request failed",
        )


async def _download_image(url: str) -> bytes | None:
    """Compatibility wrapper for callers that only need image bytes."""
    return (await _download_avatar_image(url)).image


async def _store_avatar(*, org_id: UUID, candidate_id: UUID, source: bytes) -> str | None:
    image = _normalise_image(source)
    if image is None:
        return None
    key = f"orgs/{org_id}/candidates/{candidate_id}/avatar_{uuid4()}.jpg"
    await storage_service.write_bytes(key, image, "image/jpeg")
    return await storage_service.resolve_url(key)


async def store_uploaded_candidate_avatar(
    *, org_id: UUID, candidate_id: UUID, source: bytes
) -> str | None:
    """Optimise and persist an explicitly uploaded candidate profile photo."""
    return await _store_avatar(org_id=org_id, candidate_id=candidate_id, source=source)


async def _read_document_content(document: CandidateDocument) -> bytes | None:
    try:
        return await storage_service.read_bytes(document.object_key)
    except Exception:
        logger.warning("Avatar extraction could not read document key=%s", document.object_key)
        return None


async def _document_avatar_candidate(
    document: CandidateDocument, content: bytes | None = None
) -> bytes | None:
    name = (document.name or "").lower()
    suffix = PurePosixPath(name).suffix
    content = content if content is not None else await _read_document_content(document)
    if content is None:
        return None

    # A named image attachment has higher priority than any embedded document image.
    if suffix in _IMAGE_SUFFIXES:
        if document.doc_type != "resume" or _AVATAR_NAME_RE.search(name):
            return content
        return _image_resume_header_crop(content)
    if suffix == ".pdf" or document.mime_type == "application/pdf":
        return _best_pdf_headshot(content)
    if suffix == ".docx" or "wordprocessingml.document" in (document.mime_type or ""):
        return _best_docx_headshot(content)
    if suffix == ".doc" or document.mime_type == "application/msword":
        return _best_legacy_doc_headshot(content)
    return None


def _document_avatar_source(document: CandidateDocument) -> str:
    suffix = PurePosixPath(document.name or "").suffix.lower()
    identity = " ".join(
        part for part in (document.field_key, document.field_label_snapshot, document.name) if part
    )
    if suffix in _IMAGE_SUFFIXES and _AVATAR_NAME_RE.search(identity):
        return "uploaded_photo"
    if suffix in _IMAGE_SUFFIXES:
        return "resume_image"
    return "resume_headshot"


def _document_linkedin_url(document: CandidateDocument, content: bytes) -> str | None:
    suffix = PurePosixPath(document.name or "").suffix.lower()
    if suffix not in {".pdf", ".docx", ".doc"}:
        return None
    try:
        extracted = extract_document(document.name, document.mime_type, content)
    except Exception:
        return None
    links, _ = extract_best_links(extracted.hyperlinks)
    return links.get("linkedin") or extract_linkedin_url_from_text(extracted.text)


def _document_avatar_priority(document: CandidateDocument) -> int:
    """Rank explicit portal/email photos above resume-derived images."""
    identity = " ".join(
        part for part in (document.field_key, document.field_label_snapshot, document.name) if part
    )
    suffix = PurePosixPath(document.name or "").suffix.lower()
    if suffix in _IMAGE_SUFFIXES and _AVATAR_NAME_RE.search(identity):
        return 0
    if suffix in _IMAGE_SUFFIXES and document.doc_type != "resume":
        return 1
    if suffix in _IMAGE_SUFFIXES:
        return 2
    return 3


async def enrich_candidate_profile_and_avatar(
    *, org_id: UUID, candidate_id: UUID, force_avatar_refresh: bool = False
) -> dict[str, str | bool | int]:
    """Resolve a candidate avatar without changing existing verified values."""
    async with AsyncSessionLocal() as session:
        candidate = await session.scalar(
            select(Candidate).where(Candidate.id == candidate_id, Candidate.org_id == org_id)
        )
        if candidate is None:
            return {"status": "not_found"}

        profile = candidate.parsed_resume if isinstance(candidate.parsed_resume, dict) else {}
        personal = profile.get("personal") if isinstance(profile.get("personal"), dict) else {}
        location = candidate.address or personal.get("address")
        existing_links = dict(candidate.profile_links or {})
        parsed_links = {
            key: str(value).strip()
            for key, value in {
                "linkedin": personal.get("linkedin_url"),
                "github": personal.get("github_url"),
                "portfolio": personal.get("website_url"),
            }.items()
            if isinstance(value, str) and value.strip()
        }
        if parsed_links:
            candidate.profile_links = {
                **existing_links,
                **{
                    key: value
                    for key, value in parsed_links.items()
                    if not existing_links.get(key)
                },
            }
        if candidate.phone and not candidate.phone.strip().startswith("+"):
            candidate.phone = normalize_phone_with_country(candidate.phone, location=location)
        elif not candidate.phone and isinstance(personal.get("phone"), str) and personal["phone"].strip():
            candidate.phone = normalize_phone_with_country(personal["phone"].strip(), location=location)
        if not candidate.headline:
            for key in ("headline", "professional_summary", "summary"):
                value = personal.get(key) or profile.get(key)
                if isinstance(value, str) and value.strip():
                    candidate.headline = value.strip()[:500]
                    break

        documents = (
            await session.scalars(
                select(CandidateDocument)
                .where(
                    CandidateDocument.org_id == org_id,
                    CandidateDocument.candidate_id == candidate_id,
                    CandidateDocument.is_deleted.is_(False),
                )
                .order_by(CandidateDocument.created_at.desc())
            )
        ).all()
        document_contents: list[tuple[CandidateDocument, bytes]] = []
        for document in documents:
            content = await _read_document_content(document)
            if content is not None:
                document_contents.append((document, content))

        # Existing parser output is preferred. The deterministic document scan
        # only fills an empty value, so it never overwrites a saved profile link.
        if not (candidate.profile_links or {}).get("linkedin"):
            for document, content in document_contents:
                recovered_linkedin = _document_linkedin_url(document, content)
                if recovered_linkedin:
                    candidate.profile_links = {
                        **(candidate.profile_links or {}),
                        "linkedin": recovered_linkedin,
                    }
                    break

        avatar_url = candidate.avatar_url
        avatar_source = candidate.avatar_source
        rate_limit_retry_seconds = 0
        provider_error: str | None = None
        unavatar_rate_limited = False
        # Never replace a saved avatar, including one selected manually. The
        # force argument preserves the API contract but only retries unresolved
        # candidates, preventing a refresh from changing a current photo.
        if not avatar_url:
            # Explicit photo attachments are Tier 1/2, then extract photos from resumes.
            ordered_documents = sorted(
                document_contents, key=lambda item: _document_avatar_priority(item[0])
            )
            for document, content in ordered_documents:
                source = await _document_avatar_candidate(document, content)
                if source:
                    avatar_url = await _store_avatar(org_id=org_id, candidate_id=candidate_id, source=source)
                    if avatar_url:
                        avatar_source = _document_avatar_source(document)
                        break

            if not avatar_url:
                linkedin = (candidate.profile_links or {}).get("linkedin") or parsed_links.get("linkedin")
                username = _linkedin_username(linkedin)
                if username:
                    result = await _download_avatar_image(f"https://unavatar.io/linkedin/{username}")
                    if result.image:
                        avatar_url = await _store_avatar(
                            org_id=org_id, candidate_id=candidate_id, source=result.image
                        )
                        if avatar_url:
                            avatar_source = "linkedin"
                    elif result.state == "rate_limited":
                        rate_limit_retry_seconds = max(
                            rate_limit_retry_seconds, result.retry_after_seconds
                        )
                        provider_error = result.error
                        unavatar_rate_limited = True

            if not avatar_url and candidate.email and not unavatar_rate_limited:
                # Unavatar exposes an account picture only when the public
                # Google profile has one. Email is URL-encoded to keep this
                # request bounded to a single resolver path segment.
                encoded_email = quote(candidate.email.strip().lower(), safe="")
                result = await _download_avatar_image(
                    f"https://unavatar.io/google/{encoded_email}"
                )
                if result.image:
                    avatar_url = await _store_avatar(
                        org_id=org_id, candidate_id=candidate_id, source=result.image
                    )
                    if avatar_url:
                        avatar_source = "google"
                elif result.state == "rate_limited":
                    rate_limit_retry_seconds = max(
                        rate_limit_retry_seconds, result.retry_after_seconds
                    )
                    provider_error = result.error

            if not avatar_url and candidate.email:
                email_hash = hashlib.md5(candidate.email.strip().lower().encode("utf-8")).hexdigest()
                result = await _download_avatar_image(
                    f"https://www.gravatar.com/avatar/{email_hash}?d=404&s=512"
                )
                if result.image:
                    avatar_url = await _store_avatar(
                        org_id=org_id, candidate_id=candidate_id, source=result.image
                    )
                    if avatar_url:
                        avatar_source = "gravatar"

        if avatar_url:
            candidate.avatar_url = avatar_url
            candidate.avatar_source = avatar_source or "existing"
            candidate.avatar_enrichment_status = "found"
            candidate.avatar_enrichment_error = None
            candidate.avatar_retry_at = None
        elif rate_limit_retry_seconds:
            candidate.avatar_enrichment_status = "rate_limited"
            candidate.avatar_enrichment_error = (
                provider_error or "Public avatar provider rate limited the request"
            )
            candidate.avatar_retry_at = datetime.now(timezone.utc) + timedelta(
                seconds=rate_limit_retry_seconds
            )
        else:
            candidate.avatar_enrichment_status = "not_found"
            candidate.avatar_enrichment_error = None
            candidate.avatar_retry_at = None

        candidate.is_enriched = True
        candidate.enriched_at = datetime.now(timezone.utc)
        await session.commit()
        return {
            "status": "ok",
            "avatar_found": bool(candidate.avatar_url),
            "avatar_state": candidate.avatar_enrichment_status or "not_found",
            "retry_after_seconds": rate_limit_retry_seconds,
        }
