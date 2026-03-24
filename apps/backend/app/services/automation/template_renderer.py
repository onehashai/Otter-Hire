"""
Template rendering for automation emails.

Handles variable substitution in email templates with candidate/job data.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.stage import Stage


async def build_template_context(
    db: AsyncSession,
    candidate_id: UUID,
    org_id: UUID,
    job_id: UUID | None = None,
    metadata: dict | None = None,
) -> dict[str, str]:
    """
    Build context dictionary for template variable replacement.

    Args:
        db: Database session
        candidate_id: Candidate UUID
        org_id: Organization UUID
        job_id: Optional job UUID
        metadata: Optional additional metadata from trigger

    Returns:
        Dictionary with all available template variables
    """
    context: dict[str, str] = {}

    # Fetch candidate
    candidate_stmt = select(Candidate).where(Candidate.id == candidate_id)
    candidate_result = await db.execute(candidate_stmt)
    candidate = candidate_result.scalar_one_or_none()

    if candidate:
        context["candidate_name"] = candidate.name or ""
        context["candidate_email"] = candidate.email or ""
        context["candidate_phone"] = candidate.phone or ""
        
        # Fetch stage name if candidate has a stage
        if candidate.stage_id:
            stage_stmt = select(Stage.name).where(Stage.id == candidate.stage_id)
            stage_result = await db.execute(stage_stmt)
            stage_name = stage_result.scalar_one_or_none()
            context["stage_name"] = stage_name or ""
        else:
            context["stage_name"] = ""
    else:
        logger.warning(f"Candidate {candidate_id} not found for template context")
        context["candidate_name"] = ""
        context["candidate_email"] = ""
        context["candidate_phone"] = ""
        context["stage_name"] = ""

    # Fetch job if available
    if job_id:
        job_stmt = select(Job).where(Job.id == job_id)
        job_result = await db.execute(job_stmt)
        job = job_result.scalar_one_or_none()

        if job:
            context["job_title"] = job.title or ""
            # Job location is city + country
            location_parts = []
            if job.city:
                location_parts.append(job.city)
            if job.country:
                location_parts.append(job.country)
            context["job_location"] = ", ".join(location_parts) if location_parts else ""
        else:
            context["job_title"] = ""
            context["job_location"] = ""
    else:
        context["job_title"] = ""
        context["job_location"] = ""

    # Fetch organization
    org_stmt = select(Organization).where(Organization.id == org_id)
    org_result = await db.execute(org_stmt)
    org = org_result.scalar_one_or_none()

    if org:
        context["company_name"] = org.name or ""
        context["org_name"] = org.name or ""
    else:
        context["company_name"] = ""
        context["org_name"] = ""

    # Add metadata if provided
    if metadata:
        if "stage_name" in metadata:
            context["stage_name"] = str(metadata["stage_name"])

    return context


def render_template(template_text: str, context: dict[str, str]) -> str:
    """
    Render template by replacing variables with context values.

    Uses simple string replacement for security (no code execution).
    Variables format: {{variable_name}}

    Args:
        template_text: Template string with {{variables}}
        context: Dictionary of variable values

    Returns:
        Rendered template string
    """
    if not template_text:
        return ""

    result = template_text

    # Replace each variable
    for key, value in context.items():
        placeholder = f"{{{{{key}}}}}"
        result = result.replace(placeholder, str(value or ""))

    return result
