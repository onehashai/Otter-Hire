from typing import Optional
from uuid import UUID

import pycountry
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_access_token
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.candidate_document import CandidateDocument
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.stage import Stage
from app.schemas.public_jobs import (
    PublicJobApplyRequest,
    PublicJobApplyResponse,
    PublicJobDetail,
    PublicJobListItem,
)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


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


async def get_org_member_id(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = None,
    org_uuid: UUID = None,
) -> Optional[UUID]:
    """Check if request is from org member. Returns user_id if org member, None otherwise."""
    token = None

    # Try Authorization header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    # Fallback to cookie
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")

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
