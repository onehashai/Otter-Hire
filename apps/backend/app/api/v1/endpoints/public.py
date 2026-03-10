import asyncio
import base64
import binascii
import hashlib
import hmac
import html
import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional
from urllib.parse import unquote_plus
from urllib.request import urlopen
from uuid import UUID

import pycountry
import redis.asyncio as aioredis
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import verify_access_token
from app.db.session import get_db
from app.integrations.app_store.email_integration.temporal.queue import enqueue_ses_raw_key
from app.models.candidate import Candidate
from app.models.candidate_document import CandidateDocument
from app.models.email import InboundEmail, InboundEmailAttachment
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.org_membership import OrgMembership
from app.models.organization import Organization, OrgInbox
from app.models.stage import Stage
from app.schemas.public_jobs import (
    InboundEmailPayload,
    PublicJobApplyRequest,
    PublicJobApplyResponse,
    PublicJobDetail,
    PublicJobListItem,
)
from app.services.storage import storage_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)


def _extract_s3_event_entries(payload: dict) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    if not isinstance(payload, dict):
        return entries

    records = payload.get("Records")
    if isinstance(records, list):
        for record in records:
            if not isinstance(record, dict):
                continue
            s3_obj = (record.get("s3") or {}) if isinstance(record.get("s3"), dict) else {}
            bucket = ((s3_obj.get("bucket") or {}).get("name") or "").strip()
            key = unquote_plus(((s3_obj.get("object") or {}).get("key") or "").strip())
            if bucket and key:
                entries.append((bucket, key))
        if entries:
            return entries

    # SNS wrapper payload: {"Type":"Notification","Message":"{...s3 event...}"}
    message_raw = payload.get("Message")
    if isinstance(message_raw, str) and message_raw.strip():
        try:
            nested = json.loads(message_raw)
        except Exception:
            nested = None
        if isinstance(nested, dict):
            return _extract_s3_event_entries(nested)

    bucket = str(payload.get("bucket") or "").strip()
    key = unquote_plus(str(payload.get("key") or "").strip())
    if bucket and key:
        entries.append((bucket, key))
    return entries


def get_country_name(iso_code: str) -> str:
    """Convert ISO country code to full name."""
    try:
        country = pycountry.countries.get(alpha_2=iso_code.upper())
        return country.name if country else iso_code
    except Exception:
        return iso_code


def _default_application_form_schema(job: Job) -> dict:
    profile_links = [
        {
            "id": "profile_link_linkedin",
            "key": "profile_link_linkedin",
            "label": "LinkedIn",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_github",
            "key": "profile_link_github",
            "label": "GitHub",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_portfolio",
            "key": "profile_link_portfolio",
            "label": "Portfolio / Personal Website",
            "type": "url",
            "visibility": "optional",
        },
        {
            "id": "profile_link_twitter_x",
            "key": "profile_link_twitter_x",
            "label": "Twitter / X",
            "type": "url",
            "visibility": "hidden",
        },
        {
            "id": "profile_link_dribbble",
            "key": "profile_link_dribbble",
            "label": "Dribbble",
            "type": "url",
            "visibility": "hidden",
        },
        {
            "id": "profile_link_behance",
            "key": "profile_link_behance",
            "label": "Behance",
            "type": "url",
            "visibility": "hidden",
        },
    ]
    return {
        "version": 1,
        "default_fields": {
            "full_name": {"visibility": "required", "label": "Full Name"},
            "email": {"visibility": "required", "label": "Email"},
            "phone": {"visibility": "optional", "label": "Phone Number"},
            "resume": {
                "visibility": "required" if job.collect_resume else "hidden",
                "label": "Resume",
            },
            "cover_letter": {
                "visibility": "optional" if job.collect_cover else "hidden",
                "label": "Cover Letter",
            },
        },
        "profile_links": profile_links,
        "custom_fields": [
            {
                "id": f"screening_{idx}",
                "key": f"screening_{idx}",
                "label": q,
                "type": "short_text",
                "visibility": "optional",
            }
            for idx, q in enumerate((job.screening_questions or []), start=1)
        ],
    }


def _normalized_application_form_schema(job: Job) -> dict:
    schema = dict(job.application_form_schema or _default_application_form_schema(job))
    defaults = _default_application_form_schema(job)
    schema.setdefault("version", 1)
    schema.setdefault("default_fields", defaults["default_fields"])
    schema.setdefault("custom_fields", [])
    schema.setdefault("profile_links", defaults["profile_links"])
    return schema


def _guess_file_name(file_ref: str, fallback: str) -> str:
    value = (file_ref or "").strip()
    if not value:
        return fallback
    cleaned = value.split("?")[0].rstrip("/")
    if "/" in cleaned:
        name = cleaned.rsplit("/", 1)[-1]
        return name or fallback
    return cleaned


def _is_resume_attachment(filename: str, content_type: str) -> bool:
    lower_name = (filename or "").lower()
    lower_type = (content_type or "").lower()
    if lower_name.endswith(".pdf") or lower_type in {"application/pdf"}:
        return True
    if lower_name.endswith(".docx") or lower_type in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        return True
    if lower_name.endswith(".doc") or lower_type in {"application/msword"}:
        return True
    return False


def _extract_email(text: str) -> Optional[str]:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE)
    if not match:
        return None
    return match.group(0).strip().lower()


def _extract_phone(text: str) -> Optional[str]:
    candidates = re.finditer(r"(?:\+?\d[\d()\-\s]{8,}\d)", text)
    best: Optional[str] = None
    best_score = -1

    for match in candidates:
        raw = re.sub(r"\s+", " ", match.group(0)).strip()
        # Common resume pattern: ZIP before phone, e.g. "68005 (402) 291-5432"
        raw = re.sub(r"^\d{5}\s+(?=\()", "", raw)
        score = _score_phone(raw)
        if score <= 0:
            continue

        if score > best_score:
            best_score = score
            best = raw

    return best


def _extract_location(text: str) -> Optional[str]:
    def _clean_location_candidate(raw: str) -> str:
        # Resume headers often mix location + phone/email with separators.
        # Keep only the left-most location-like segment.
        part = re.split(r"[•|]", raw, maxsplit=1)[0]
        part = re.sub(r"\s+", " ", part).strip(" ,;-")
        return part

    def _looks_like_location(value: str) -> bool:
        if len(value) < 4 or len(value) > 60:
            return False
        if any(ch.isdigit() for ch in value):
            return False
        # Require comma-separated city + state/region/country style.
        if "," not in value:
            return False
        # Reject job/company-like phrases.
        job_tokens = {
            "intern",
            "engineer",
            "developer",
            "manager",
            "analyst",
            "research",
            "limited",
            "private",
            "technologies",
            "solutions",
            "software",
        }
        lowered = value.lower()
        if any(token in lowered for token in job_tokens):
            return False
        return bool(re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}", value))

    blocked_tokens = {
        "bachelor",
        "master",
        "university",
        "college",
        "curriculum",
        "vitae",
        "resume",
        "experience",
        "education",
        "objective",
        "skills",
        "certification",
        "project",
        "linkedin",
        "github",
    }
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:20]:
        if len(line) > 80:
            continue
        lowered = line.lower()
        if any(token in lowered for token in blocked_tokens):
            continue
        if re.search(r"\(\s*\(", line):
            continue
        alpha_count = sum(1 for ch in line if ch.isalpha())
        if alpha_count < 4:
            continue

        candidate = _clean_location_candidate(line)
        if _looks_like_location(candidate):
            return candidate

        # Primary pattern: "City, State/Region [ZIP optional]"
        if re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}(?:\s+\d{4,6})?", line):
            return line

        # Secondary pattern: clean comma phrase without obvious job/company tokens.
        symbol_count = sum(1 for ch in line if not (ch.isalnum() or ch.isspace() or ch in ",.-'"))
        if symbol_count > 2:
            continue
        relaxed = _clean_location_candidate(line)
        if _looks_like_location(relaxed):
            return relaxed
    return None


def _score_location(value: Optional[str]) -> int:
    if not value:
        return 0
    line = value.strip()
    lowered = line.lower()
    if len(line) < 4 or len(line) > 80:
        return 0

    blocked_tokens = {
        "bachelor",
        "master",
        "university",
        "college",
        "curriculum",
        "vitae",
        "resume",
        "experience",
        "education",
        "objective",
        "skills",
        "certification",
        "project",
    }
    if any(token in lowered for token in blocked_tokens):
        return 0
    if "@" in line:
        return 0

    score = 1
    if "," in line:
        score += 2
    if re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}(?:\s+\d{4,6})?", line):
        score += 3
    if re.search(r"\(\s*\(", line):
        score -= 3
    symbol_count = sum(1 for ch in line if not (ch.isalnum() or ch.isspace() or ch in ",.-'"))
    if symbol_count > 2:
        score -= 2
    return max(score, 0)


def _should_replace_location(existing_location: Optional[str], new_location: Optional[str]) -> bool:
    existing_score = _score_location(existing_location)
    new_score = _score_location(new_location)
    # Clear noisy existing OCR location when new parse no longer finds a reliable location.
    if new_location is None and existing_score <= 1:
        return True
    if not new_location:
        return False
    if not existing_location:
        return True
    return new_score > existing_score


def _extract_name(text: str, fallback_email: Optional[str]) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:12]:
        if len(line) > 80:
            continue
        if "@" in line:
            continue
        if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,60}", line):
            return line
    if fallback_email and "@" in fallback_email:
        local = fallback_email.split("@", 1)[0].replace(".", " ").replace("_", " ")
        local = " ".join(part for part in local.split() if part)
        if local:
            return local.title()
    return None


def _looks_like_person_name(value: Optional[str]) -> bool:
    if not value:
        return False
    name = value.strip()
    if len(name) < 3 or len(name) > 80:
        return False
    if "@" in name:
        return False
    if re.search(r"\d", name):
        return False
    parts = [p for p in re.split(r"\s+", name) if p]
    return len(parts) >= 2


def _resume_confidence_score(
    text: str,
    extracted_name: Optional[str],
    extracted_email: Optional[str],
    extracted_phone: Optional[str],
    extracted_location: Optional[str],
) -> int:
    normalized = re.sub(r"\s+", " ", (text or "")).strip().lower()
    score = 0

    if extracted_email and extracted_email.endswith("@invalid.local") is False:
        score += 2
    if extracted_phone:
        score += 2
    if _looks_like_person_name(extracted_name):
        score += 2
    if extracted_location:
        score += 1

    if len(normalized) >= 120:
        score += 2
    elif len(normalized) >= 60:
        score += 1

    resume_keywords = {
        "experience",
        "education",
        "skills",
        "projects",
        "summary",
        "employment",
        "work history",
        "certification",
        "linkedin",
        "github",
    }
    keyword_hits = sum(1 for keyword in resume_keywords if keyword in normalized)
    score += min(keyword_hits, 3)

    return score


def _normalize_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None


def _score_phone(value: Optional[str]) -> int:
    if not value:
        return 0
    raw = re.sub(r"\s+", " ", value).strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 10 or len(digits) > 15:
        return 0

    score = 0
    if raw.startswith("+"):
        score += 2
    if "(" in raw and ")" in raw:
        score += 2
    if "-" in raw:
        score += 1
    if len(digits) in {10, 11}:
        score += 2
    if re.match(r"^\d{5}\s+\(", raw):
        score -= 3
    if len(raw) > 24:
        score -= 1
    return score


def _should_replace_phone(existing_phone: Optional[str], new_phone: Optional[str]) -> bool:
    if not new_phone:
        return False
    if not existing_phone:
        return True
    return _score_phone(new_phone) > _score_phone(existing_phone)


def _parse_resume_bytes(filename: str, content_type: str, content: bytes) -> str:
    def _is_low_text(value: str) -> bool:
        normalized = re.sub(r"\s+", " ", (value or "")).strip()
        return len(normalized) < 80

    def _ocr_pdf_bytes(pdf_bytes: bytes) -> str:
        import pypdfium2 as pdfium
        import pytesseract

        text_chunks: list[str] = []
        pdf = pdfium.PdfDocument(pdf_bytes)
        page_count = min(len(pdf), 3)
        for page_index in range(page_count):
            page = pdf[page_index]
            pil_image = page.render(scale=2).to_pil()
            ocr_text = pytesseract.image_to_string(pil_image)
            if ocr_text and ocr_text.strip():
                text_chunks.append(ocr_text.strip())
        return "\n".join(text_chunks).strip()

    def _ocr_docx_bytes(docx_bytes: bytes) -> str:
        import pytesseract
        from PIL import Image

        text_chunks: list[str] = []
        with zipfile.ZipFile(BytesIO(docx_bytes)) as archive:
            media_files = [name for name in archive.namelist() if name.startswith("word/media/")]
            for media_name in media_files[:4]:
                image_bytes = archive.read(media_name)
                try:
                    image = Image.open(BytesIO(image_bytes))
                    ocr_text = pytesseract.image_to_string(image)
                    if ocr_text and ocr_text.strip():
                        text_chunks.append(ocr_text.strip())
                except Exception:
                    continue
        return "\n".join(text_chunks).strip()

    lower_name = (filename or "").lower()
    lower_type = (content_type or "").lower()
    if lower_name.endswith(".pdf") or lower_type == "application/pdf":
        from pdfminer.high_level import extract_text

        parsed = (extract_text(BytesIO(content)) or "").strip()
        if not _is_low_text(parsed):
            return parsed
        try:
            ocr = _ocr_pdf_bytes(content)
            if ocr:
                return ocr
        except Exception:
            pass
        return parsed
    if lower_name.endswith(".docx") or lower_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        from docx import Document

        document = Document(BytesIO(content))
        parsed = "\n".join((p.text or "").strip() for p in document.paragraphs).strip()
        if not _is_low_text(parsed):
            return parsed
        try:
            ocr = _ocr_docx_bytes(content)
            if ocr:
                return ocr
        except Exception:
            pass
        return parsed
    raise ValueError("Unsupported resume format")


def _verify_hmac_signature(signature_header: str, secret: str, raw_body: bytes) -> bool:
    if not signature_header.startswith("sha256="):
        return False
    provided = signature_header.split("=", 1)[1].strip()
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided, expected)


def _email_domain(value: str) -> str:
    parts = (value or "").strip().lower().rsplit("@", 1)
    return parts[1] if len(parts) == 2 else ""


def _detect_verification_provider(from_email: str, subject: str, body_text: str) -> str | None:
    source = " ".join([subject.lower(), body_text.lower()])
    domain = _email_domain(from_email)
    gmail_domains = {"google.com", "accounts.google.com", "gmail.com", "googlemail.com"}
    outlook_domains = {"outlook.com", "office.com", "microsoft.com", "live.com"}

    if domain in gmail_domains or any(domain.endswith(f".{item}") for item in gmail_domains):
        if any(
            token in source
            for token in [
                "forwarding",
                "gmail forwarding",
                "confirm forwarding",
                "forward mail",
            ]
        ):
            return "gmail"

    if domain in outlook_domains or any(domain.endswith(f".{item}") for item in outlook_domains):
        if any(
            token in source
            for token in [
                "forwarding",
                "outlook forwarding",
                "confirm forwarding",
                "forward mail",
            ]
        ):
            return "outlook"
    return None


def _is_allowed_verification_url(value: str) -> bool:
    match = re.match(r"^https://([^/\s]+)", (value or "").strip(), re.IGNORECASE)
    if not match:
        return False
    host = match.group(1).lower()
    allowed_suffixes = (
        "google.com",
        "mail.google.com",
        "support.google.com",
        "outlook.com",
        "office.com",
        "microsoft.com",
        "live.com",
    )
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in allowed_suffixes)


def _extract_verification_action(body_text: str) -> dict:
    # Most providers include a confirmation link for forwarding verification.
    for candidate in re.findall(r"https://[^\s<>\"]+", body_text):
        if _is_allowed_verification_url(candidate):
            return {"type": "link", "url": candidate}
    code_match = re.search(r"\b(\d{6,8})\b", body_text)
    if code_match:
        return {"type": "code", "code": code_match.group(1)}
    return {"type": "manual"}


def _is_verification_email(from_email: str, subject: str, body_text: str) -> bool:
    provider = _detect_verification_provider(from_email, subject, body_text)
    if provider is None:
        return False
    source = " ".join([subject.lower(), body_text.lower()])
    forwarding_markers = [
        "forwarding",
        "confirm forwarding",
        "forward mail",
        "forwarded to",
    ]
    return any(token in source for token in forwarding_markers)


def _extract_request_token(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "", 1).strip()
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token.strip()
    return None


def _topic_allowed(topic_arn: str) -> bool:
    allowed = [item.strip() for item in settings.inbound_sns_topic_arns.split(",") if item.strip()]
    if not allowed:
        return True
    return topic_arn in allowed


def _confirm_sns_subscription(subscribe_url: str) -> bool:
    value = (subscribe_url or "").strip()
    if not value:
        return False
    if not value.startswith("https://"):
        return False
    try:
        with urlopen(value, timeout=10) as response:
            return 200 <= int(response.status) < 300
    except Exception:
        return False


async def get_org_member_id(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = None,
    org_uuid: UUID = None,
) -> Optional[UUID]:
    """Check if request is from org member. Returns user_id if org member, None otherwise."""
    token = _extract_request_token(request, authorization)

    if not token:
        return None

    try:
        payload = verify_access_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            return None

        # Verify active membership in org
        result = await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == UUID(user_id),
                OrgMembership.org_id == org_uuid,
                OrgMembership.status == "active",
            )
        )
        membership = result.scalar_one_or_none()
        return UUID(user_id) if membership else None
    except Exception:
        return None


@router.get("/orgs/{org_id}/jobs", response_model=list[PublicJobListItem])
@limiter.limit("60/minute")
async def get_public_jobs(
    request: Request,
    response: Response,
    org_id: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get all public jobs for an organization."""
    try:
        org_uuid = UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Verify org exists
    org_result = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if user is org member
    is_org_member = await get_org_member_id(request, authorization, db, org_uuid) is not None

    # Get jobs based on membership
    if is_org_member:
        # Org members see draft + open jobs
        result = await db.execute(
            select(Job)
            .where(
                Job.org_id == org_uuid,
                or_(Job.status == "draft", Job.status == "open"),
            )
            .order_by(Job.created_at.desc())
        )
    else:
        # Public sees only open + public jobs
        result = await db.execute(
            select(Job)
            .where(
                Job.org_id == org_uuid,
                Job.status == "open",
                Job.visibility == "public",
            )
            .order_by(Job.published_at.desc())
        )
    jobs = result.scalars().all()

    # Set cache headers
    response.headers["Cache-Control"] = "public, max-age=60"

    def format_location(job):
        """Format location as 'City (State), Country Name'"""
        if job.city and job.country:
            # Parse city: "Indore|MP" -> "Indore (MP)"
            if "|" in job.city:
                city_name, state = job.city.split("|", 1)
                formatted_city = f"{city_name} ({state})"
            else:
                formatted_city = job.city

            # Convert country code to name: "IN" -> "India"
            country_name = get_country_name(job.country)
            return f"{formatted_city}, {country_name}"
        if job.city:
            # Handle city with state but no country
            if "|" in job.city:
                city_name, state = job.city.split("|", 1)
                return f"{city_name} ({state})"
            return job.city
        if job.country:
            return get_country_name(job.country)
        return job.workplace_type or "Remote"

    return [
        PublicJobListItem(
            id=str(job.id),
            title=job.title,
            description=job.description,
            category=job.category,
            employment_type=job.employment_type,
            workplace_type=job.workplace_type,
            location=format_location(job),
            salary_min=job.salary_min if job.salary_type == "range" else None,
            salary_max=job.salary_max if job.salary_type == "range" else None,
            salary_fixed=job.salary_fixed if job.salary_type == "fixed" else None,
            currency=job.currency,
            salary_timeframe=job.salary_timeframe,
            published_at=job.published_at or job.created_at,
            status=job.status,
        )
        for job in jobs
    ]


@router.get("/orgs/{org_id}/jobs/{job_id}", response_model=PublicJobDetail)
@limiter.limit("120/minute")
async def get_public_job_detail(
    request: Request,
    response: Response,
    org_id: str,
    job_id: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Get public job detail."""
    try:
        org_uuid = UUID(org_id)
        job_uuid = UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if user is org member
    is_org_member = await get_org_member_id(request, authorization, db, org_uuid) is not None

    # Get job based on membership
    if is_org_member:
        # Org members see draft + open jobs
        result = await db.execute(
            select(Job, Organization)
            .join(Organization, Job.org_id == Organization.id)
            .where(
                Job.id == job_uuid,
                Job.org_id == org_uuid,
                or_(Job.status == "draft", Job.status == "open"),
            )
        )
    else:
        # Public sees only open + public jobs
        result = await db.execute(
            select(Job, Organization)
            .join(Organization, Job.org_id == Organization.id)
            .where(
                Job.id == job_uuid,
                Job.org_id == org_uuid,
                Job.status == "open",
                Job.visibility == "public",
            )
        )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    job, org = row

    # Set cache headers
    response.headers["Cache-Control"] = "public, max-age=60"

    # Format city: "Indore|MP" -> "Indore (MP)"
    formatted_city = job.city
    if job.city and "|" in job.city:
        city_name, state = job.city.split("|", 1)
        formatted_city = f"{city_name} ({state})"

    # Convert country code to name
    formatted_country = get_country_name(job.country) if job.country else None

    return PublicJobDetail(
        id=str(job.id),
        title=job.title,
        description=job.description,
        category=job.category,
        employment_type=job.employment_type,
        workplace_type=job.workplace_type,
        country=formatted_country,
        city=formatted_city,
        salary_min=job.salary_min if job.salary_type == "range" else None,
        salary_max=job.salary_max if job.salary_type == "range" else None,
        salary_fixed=job.salary_fixed if job.salary_type == "fixed" else None,
        currency=job.currency,
        salary_timeframe=job.salary_timeframe,
        published_at=job.published_at or job.created_at,
        org_name=org.name,
        status=job.status,
        application_form_schema=_normalized_application_form_schema(job),
    )


@router.post(
    "/orgs/{org_id}/jobs/{job_id}/apply", response_model=PublicJobApplyResponse, status_code=201
)
@limiter.limit("30/minute")
async def apply_public_job(
    request: Request,
    org_id: str,
    job_id: str,
    body: PublicJobApplyRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        org_uuid = UUID(org_id)
        job_uuid = UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await db.execute(
        select(Job).where(
            Job.id == job_uuid,
            Job.org_id == org_uuid,
            Job.status == "open",
            Job.visibility == "public",
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    schema = _normalized_application_form_schema(job)
    default_fields = schema.get("default_fields", {})
    profile_links = schema.get("profile_links", [])
    custom_fields = schema.get("custom_fields", [])
    custom_fields_by_key: dict[str, dict] = {}
    for field in custom_fields:
        field_key = field.get("key") or field.get("id")
        if field_key:
            custom_fields_by_key[str(field_key)] = field

    def visibility(key: str) -> str:
        field_cfg = default_fields.get(key, {})
        return str(field_cfg.get("visibility", "hidden"))

    if visibility("full_name") == "required" and not body.full_name.strip():
        raise HTTPException(status_code=422, detail="Full name is required")
    if visibility("email") == "required" and not body.email.strip():
        raise HTTPException(status_code=422, detail="Email is required")
    if visibility("phone") == "required" and not (body.phone or "").strip():
        raise HTTPException(status_code=422, detail="Phone is required")

    files = body.files or {}
    if visibility("resume") == "required" and not files.get("resume"):
        raise HTTPException(status_code=422, detail="Resume is required")
    if visibility("cover_letter") == "required":
        has_cover_text = bool(str(body.answers.get("cover_letter", "")).strip())
        has_cover_file = bool(files.get("cover_letter"))
        if not has_cover_text and not has_cover_file:
            raise HTTPException(status_code=422, detail="Cover letter is required")

    allowed_answer_keys = set()
    allowed_file_keys = set()
    if visibility("resume") != "hidden":
        allowed_file_keys.add("resume")
    if visibility("cover_letter") != "hidden":
        allowed_file_keys.add("cover_letter")
    if visibility("cover_letter") != "hidden":
        allowed_answer_keys.add("cover_letter")
    for field in list(profile_links) + list(custom_fields):
        field_visibility = field.get("visibility", "hidden")
        field_key = field.get("key") or field.get("id")
        if not field_key:
            continue
        field_key = str(field_key)
        field_type = str(field.get("type") or "short_text")
        if field_type == "file_upload":
            allowed_file_keys.add(field_key)
        else:
            allowed_answer_keys.add(field_key)
        if field_visibility == "required" and field_type == "file_upload":
            if not files.get(field_key):
                raise HTTPException(
                    status_code=422, detail=f"{field.get('label', field_key)} is required"
                )
        elif field_visibility == "required":
            val = body.answers.get(field_key)
            if val is None or (isinstance(val, str) and not val.strip()):
                raise HTTPException(
                    status_code=422, detail=f"{field.get('label', field_key)} is required"
                )

    extra_keys = set(body.answers.keys()) - allowed_answer_keys
    if extra_keys:
        raise HTTPException(status_code=422, detail="Unexpected custom field answers provided")
    extra_file_keys = set(files.keys()) - allowed_file_keys
    if extra_file_keys:
        raise HTTPException(status_code=422, detail="Unexpected file fields provided")

    application = JobApplication(
        org_id=org_uuid,
        job_id=job_uuid,
        full_name=body.full_name.strip(),
        email=body.email.strip().lower(),
        phone=(body.phone or "").strip() or None,
        answers=body.answers,
        files=files or None,
        schema_snapshot=schema,
        schema_version=int(schema.get("version", 1)),
        status="submitted",
    )
    db.add(application)

    # Upsert into candidate pipeline for recruiter workflows.
    existing_candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == org_uuid,
            Candidate.job_id == job_uuid,
            func.lower(Candidate.email) == body.email.strip().lower(),
        )
    )
    candidate = existing_candidate_result.scalar_one_or_none()

    if candidate is None:
        first_stage_result = await db.execute(
            select(Stage)
            .where(Stage.org_id == org_uuid, Stage.job_id == job_uuid)
            .order_by(Stage.position.asc())
            .limit(1)
        )
        first_stage = first_stage_result.scalar_one_or_none()

        candidate = Candidate(
            org_id=org_uuid,
            job_id=job_uuid,
            stage_id=first_stage.id if first_stage else None,
            status="active",
            name=body.full_name.strip(),
            email=body.email.strip().lower(),
            phone=(body.phone or "").strip() or None,
            source="job_board",
            tags=[],
        )
        db.add(candidate)
    else:
        candidate.name = body.full_name.strip() or candidate.name
        candidate.phone = (body.phone or "").strip() or candidate.phone

    if isinstance(files, dict):
        for field_key, file_ref in files.items():
            if not isinstance(file_ref, str) or not file_ref.strip():
                continue
            file_url = file_ref.strip()
            label = field_key.replace("_", " ").title()
            doc_type = "custom_field_attachment"
            if field_key == "resume":
                label = default_fields.get("resume", {}).get("label", "Resume")
                doc_type = "resume"
            elif field_key == "cover_letter":
                label = default_fields.get("cover_letter", {}).get("label", "Cover Letter")
                doc_type = "cover_letter"
            elif field_key in custom_fields_by_key:
                label = custom_fields_by_key[field_key].get("label", label)

            existing_version_result = await db.execute(
                select(func.max(CandidateDocument.version)).where(
                    CandidateDocument.org_id == org_uuid,
                    CandidateDocument.candidate_id == candidate.id,
                    CandidateDocument.field_key == field_key,
                )
            )
            latest_version = existing_version_result.scalar_one_or_none() or 0

            object_key = file_url
            if file_url.startswith("/api/files/local/"):
                object_key = file_url.removeprefix("/api/files/local/")
            elif file_url.startswith("/files/local/"):
                object_key = file_url.removeprefix("/files/local/")

            db.add(
                CandidateDocument(
                    org_id=org_uuid,
                    candidate_id=candidate.id,
                    job_id=job_uuid,
                    field_key=field_key,
                    field_label_snapshot=str(label) if label else None,
                    doc_type=doc_type,
                    name=_guess_file_name(file_url, f"{field_key}.bin"),
                    url=file_url,
                    object_key=object_key,
                    mime_type="application/octet-stream",
                    size_bytes=0,
                    uploaded_by_user_id=None,
                    version=int(latest_version) + 1,
                )
            )

    await db.commit()
    await db.refresh(application)

    return PublicJobApplyResponse(
        id=str(application.id),
        status=application.status,
    )


@router.post("/inbound/email")
@limiter.limit("30/minute")
async def ingest_inbound_email(
    request: Request,
    signature: str = Header(default="", alias="X-OneHash-Signature"),
    db: AsyncSession = Depends(get_db),
):
    raw_body = await request.body()
    try:
        payload = InboundEmailPayload.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid inbound payload")

    inbox_address = payload.inbox_address.strip().lower()
    inbox_result = await db.execute(select(OrgInbox).where(OrgInbox.inbox_address == inbox_address))
    org_inbox = inbox_result.scalar_one_or_none()
    if org_inbox is None:
        raise HTTPException(status_code=404, detail="Inbox configuration not found")

    secret = org_inbox.secret_hash or settings.inbound_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Inbound webhook secret is not configured")
    if not _verify_hmac_signature(signature, secret, raw_body):
        raise HTTPException(status_code=401, detail="Invalid signature")
    if payload.message_id:
        existing_result = await db.execute(
            select(InboundEmail).where(
                InboundEmail.org_id == org_inbox.org_id,
                InboundEmail.message_id == payload.message_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing is not None:
            return {
                "status": "ok",
                "message": "Already processed",
                "inbound_email_id": str(existing.id),
                "org_id": str(org_inbox.org_id),
            }

    has_resume = any(
        _is_resume_attachment(att.filename, att.content_type) for att in (payload.attachments or [])
    )
    inbound_email = InboundEmail(
        org_id=org_inbox.org_id,
        inbox_address=inbox_address,
        from_email=(payload.from_email or "").strip().lower() or None,
        from_name=(payload.from_name or "").strip() or None,
        subject=(payload.subject or "").strip() or None,
        message_id=(payload.message_id or "").strip() or None,
        received_at=payload.received_at or datetime.now(timezone.utc),
        raw_storage_key=(payload.raw_storage_key or "").strip() or None,
        email_kind="candidate",
        has_resume_attachment=has_resume,
        parse_status="ignored",
        parse_error=None,
    )
    db.add(inbound_email)
    await db.flush()

    parsed_candidate: Candidate | None = None
    parse_error: str | None = None
    resume_attachment: InboundEmailAttachment | None = None
    resume_text: str = ""
    body_text = "\n".join(
        [
            payload.subject or "",
            payload.text_body or "",
            html.unescape(re.sub(r"<[^>]+>", " ", payload.html_body or "")),
        ]
    ).strip()

    for idx, att in enumerate(payload.attachments or []):
        if not att.content_base64:
            continue
        try:
            content = base64.b64decode(att.content_base64, validate=True)
        except (ValueError, binascii.Error):
            continue
        if len(content) > settings.inbound_max_attachment_bytes:
            continue
        safe_name = _guess_file_name(att.filename, f"attachment_{idx + 1}.bin")
        storage_key = (
            f"orgs/{org_inbox.org_id}/inbox/attachments/{inbound_email.id}/{idx + 1}_{safe_name}"
        )
        await storage_service.write_bytes(
            storage_key, content, att.content_type or "application/octet-stream"
        )
        attachment_row = InboundEmailAttachment(
            inbound_email_id=inbound_email.id,
            filename=safe_name,
            content_type=att.content_type or "application/octet-stream",
            storage_key=storage_key,
            size_bytes=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
        )
        db.add(attachment_row)

        if resume_attachment is None and _is_resume_attachment(safe_name, att.content_type):
            resume_attachment = attachment_row
            try:
                resume_text = _parse_resume_bytes(safe_name, att.content_type, content)
            except Exception as exc:
                parse_error = f"Resume parse failed: {exc}"

    inbound_from_email = (inbound_email.from_email or "").strip()
    inbound_subject = (inbound_email.subject or "").strip()
    if _is_verification_email(inbound_from_email, inbound_subject, body_text):
        provider = _detect_verification_provider(inbound_from_email, inbound_subject, body_text)
        action = _extract_verification_action(body_text)
        if provider is None or action.get("type") == "manual":
            logger.info(
                "Skipping weak verification match inbox=%s from=%s subject=%s provider=%s action_type=%s",
                org_inbox.inbox_address,
                inbound_from_email,
                inbound_subject,
                provider,
                action.get("type"),
            )
        else:
            inbound_email.email_kind = "verification"
            inbound_email.parse_status = "ignored"
            inbound_email.parse_error = "Verification email captured"
            org_inbox.verification_status = "action_required"
            org_inbox.verification_provider = provider or "unknown"
            org_inbox.verification_email_id = inbound_email.id
            org_inbox.verification_action_type = action.get("type")
            org_inbox.verification_action_payload = action
            org_inbox.verification_detected_at = datetime.now(timezone.utc)
            org_inbox.verification_error = None
            org_inbox.status = "pending"
            logger.info(
                "Verification email detected inbox=%s provider=%s action_type=%s",
                org_inbox.inbox_address,
                provider,
                action.get("type"),
            )
            await db.commit()
            return {
                "status": "ok",
                "message": "Verification email detected",
                "inbound_email_id": str(inbound_email.id),
                "org_id": str(org_inbox.org_id),
            }

    if org_inbox.status != "active":
        inbound_email.parse_status = "ignored"
        inbound_email.parse_error = "Inbox is pending verification"
        await db.commit()
        return {
            "status": "ok",
            "message": "Ignored: inbox pending verification",
            "inbound_email_id": str(inbound_email.id),
            "org_id": str(org_inbox.org_id),
        }

    if not has_resume or resume_attachment is None:
        inbound_email.parse_status = "ignored"
        inbound_email.parse_error = "No resume attachment found"
        await db.commit()
        return {
            "status": "ok",
            "message": "Ignored: no resume attachment",
            "inbound_email_id": str(inbound_email.id),
            "org_id": str(org_inbox.org_id),
        }

    if parse_error:
        inbound_email.parse_status = "failed"
        inbound_email.parse_error = parse_error
        await db.commit()
        return {
            "status": "ok",
            "message": "Stored with parse failure",
            "inbound_email_id": str(inbound_email.id),
            "org_id": str(org_inbox.org_id),
        }

    extracted_email = _extract_email(resume_text) or inbound_email.from_email
    extracted_phone = _extract_phone(resume_text)
    extracted_name = _extract_name(resume_text, extracted_email) or "Unknown Candidate"
    extracted_location = _extract_location(resume_text)
    confidence = _resume_confidence_score(
        resume_text,
        extracted_name,
        extracted_email,
        extracted_phone,
        extracted_location,
    )
    min_confidence = max(1, int(settings.inbound_resume_min_confidence))
    if confidence < min_confidence:
        inbound_email.parse_status = "ignored"
        inbound_email.parse_error = (
            f"Low resume confidence ({confidence}<{min_confidence}); candidate not created"
        )
        await db.commit()
        return {
            "status": "ok",
            "message": "Ignored: low resume confidence",
            "inbound_email_id": str(inbound_email.id),
            "org_id": str(org_inbox.org_id),
        }

    candidate_query = None
    if extracted_email:
        candidate_query = await db.execute(
            select(Candidate).where(
                Candidate.org_id == org_inbox.org_id,
                func.lower(Candidate.email) == extracted_email.lower(),
            )
        )
    elif extracted_phone:
        normalized_phone = _normalize_phone(extracted_phone)
        if normalized_phone:
            candidate_query = await db.execute(
                select(Candidate).where(
                    Candidate.org_id == org_inbox.org_id,
                    Candidate.phone.is_not(None),
                    func.regexp_replace(Candidate.phone, r"\\D", "", "g") == normalized_phone,
                )
            )
    candidate = candidate_query.scalars().first() if candidate_query is not None else None

    if candidate is None:
        candidate = Candidate(
            org_id=org_inbox.org_id,
            job_id=None,
            stage_id=None,
            status="active",
            name=extracted_name,
            email=extracted_email or f"unknown+{inbound_email.id}@invalid.local",
            phone=extracted_phone,
            location=extracted_location,
            profile_links={},
            source="email_inbound",
            tags=[],
        )
        db.add(candidate)
        await db.flush()
    else:
        if extracted_name and (not candidate.name or candidate.name == "Unknown Candidate"):
            candidate.name = extracted_name
        if _should_replace_phone(candidate.phone, extracted_phone):
            candidate.phone = extracted_phone
        if _should_replace_location(candidate.location, extracted_location):
            candidate.location = extracted_location

    latest_version_result = await db.execute(
        select(func.max(CandidateDocument.version)).where(
            CandidateDocument.org_id == org_inbox.org_id,
            CandidateDocument.candidate_id == candidate.id,
            CandidateDocument.field_key == "resume",
        )
    )
    latest_version = latest_version_result.scalar_one_or_none() or 0
    existing_hash_result = await db.execute(
        select(InboundEmailAttachment.sha256)
        .join(
            CandidateDocument,
            CandidateDocument.object_key == InboundEmailAttachment.storage_key,
        )
        .where(
            CandidateDocument.org_id == org_inbox.org_id,
            CandidateDocument.candidate_id == candidate.id,
            CandidateDocument.field_key == "resume",
        )
        .order_by(CandidateDocument.created_at.desc())
        .limit(1)
    )
    latest_resume_hash = existing_hash_result.scalar_one_or_none()
    if latest_resume_hash != resume_attachment.sha256:
        resume_url = await storage_service.resolve_url(resume_attachment.storage_key)
        db.add(
            CandidateDocument(
                org_id=org_inbox.org_id,
                candidate_id=candidate.id,
                job_id=None,
                field_key="resume",
                field_label_snapshot="Resume",
                doc_type="resume",
                name=resume_attachment.filename,
                url=resume_url,
                object_key=resume_attachment.storage_key,
                mime_type=resume_attachment.content_type,
                size_bytes=resume_attachment.size_bytes,
                uploaded_by_user_id=None,
                version=int(latest_version) + 1,
            )
        )
    parsed_candidate = candidate

    inbound_email.parsed_candidate_id = parsed_candidate.id
    inbound_email.parse_status = "processed"
    inbound_email.parse_error = None
    await db.commit()

    return {
        "status": "ok",
        "message": "Processed",
        "inbound_email_id": str(inbound_email.id),
        "candidate_id": str(parsed_candidate.id),
        "org_id": str(org_inbox.org_id),
    }


@router.post("/inbound/s3-event")
@limiter.limit("120/minute")
async def enqueue_inbound_s3_event(
    request: Request,
):
    if not settings.inbound_async_pipeline_enabled:
        raise HTTPException(status_code=409, detail="Async inbound pipeline is disabled")
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid event payload")

    message_type = str(payload.get("Type") or "").strip()
    if message_type == "SubscriptionConfirmation":
        topic_arn = str(payload.get("TopicArn") or "").strip()
        if topic_arn and not _topic_allowed(topic_arn):
            raise HTTPException(status_code=403, detail="SNS topic is not allowed")
        if settings.inbound_sns_auto_confirm:
            subscribe_url = str(payload.get("SubscribeURL") or "").strip()
            if not _confirm_sns_subscription(subscribe_url):
                raise HTTPException(status_code=502, detail="Failed to confirm SNS subscription")
        return {"status": "accepted", "message": "subscription_confirmation_received"}

    if message_type == "Notification":
        topic_arn = str(payload.get("TopicArn") or "").strip()
        if topic_arn and not _topic_allowed(topic_arn):
            raise HTTPException(status_code=403, detail="SNS topic is not allowed")

    entries = _extract_s3_event_entries(payload)
    if not entries:
        raise HTTPException(status_code=422, detail="No S3 object entries found")

    deduped_entries: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for entry in entries:
        if entry in seen:
            continue
        seen.add(entry)
        deduped_entries.append(entry)

    task_ids: list[str] = []
    for bucket, key in deduped_entries:
        task_ids.append(await enqueue_ses_raw_key(bucket, key))

    return {
        "status": "accepted",
        "count": len(task_ids),
        "task_ids": task_ids,
    }


@router.websocket("/inbound/events/ws")
async def inbound_events_ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = verify_access_token(token)
    except Exception:
        await websocket.close(code=4401)
        return
    org_id = str(payload.get("org_id") or "").strip()
    if not org_id:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis_client.pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(settings.inbound_events_channel)
    try:
        while True:
            message = await pubsub.get_message(timeout=1.0)
            if message and message.get("type") == "message":
                raw_data = message.get("data", "")
                try:
                    data = json.loads(str(raw_data))
                except Exception:
                    continue
                event_org_id = str(data.get("org_id") or "").strip()
                if event_org_id and event_org_id != org_id:
                    continue
                await websocket.send_text(json.dumps(data))
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await pubsub.close()
        except Exception:
            pass
        try:
            await redis_client.close()
        except Exception:
            pass
