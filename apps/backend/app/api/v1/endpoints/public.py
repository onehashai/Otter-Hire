from fastapi import APIRouter, Depends, HTTPException, Request, Response, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from uuid import UUID
from slowapi import Limiter
from slowapi.util import get_remote_address
import pycountry
from typing import Optional

from app.db.session import get_db
from app.models.job import Job
from app.models.organization import Organization
from app.models.user import User
from app.schemas.public_jobs import PublicJobListItem, PublicJobDetail
from app.core.security import verify_access_token

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def get_country_name(iso_code: str) -> str:
    """Convert ISO country code to full name."""
    try:
        country = pycountry.countries.get(alpha_2=iso_code.upper())
        return country.name if country else iso_code
    except:
        return iso_code


async def get_org_member_id(request: Request, authorization: Optional[str] = Header(None), db: AsyncSession = None, org_uuid: UUID = None) -> Optional[UUID]:
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
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Verify user belongs to org
        result = await db.execute(
            select(User).where(User.id == UUID(user_id), User.org_id == org_uuid)
        )
        user = result.scalar_one_or_none()
        return UUID(user_id) if user else None
    except:
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
    org_result = await db.execute(
        select(Organization).where(Organization.id == org_uuid)
    )
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
            department=job.department,
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
        department=job.department,
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
    )
