import json
import logging
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.job import Job
from app.core.config import settings
import openai

logger = logging.getLogger(__name__)

async def match_candidate_to_active_job(
    org_id: UUID,
    resume_text: str,
    email_subject: str,
    db: AsyncSession,
) -> Job | None:
    """
    Retrieves all published jobs for an organization and prompts OpenAI
    to select the best match for the candidate's resume.
    """
    if not settings.openai_api_key:
        logger.warning("OpenAI API key is missing. Skipping AI job matching.")
        return None

    try:
        # Fetch all published/active jobs in the organization
        result = await db.execute(
            select(Job).where(
                Job.org_id == org_id,
                Job.status == "open"
            )
        )
        active_jobs = result.scalars().all()
        if not active_jobs:
            logger.info("No active published jobs found for org %s", org_id)
            return None

        # Build light job profiles
        job_profiles = [
            {"id": str(job.id), "title": job.title, "description": job.description[:500]}
            for job in active_jobs
        ]

        prompt = f"""
        You are an AI recruiting assistant. Given the candidate's email subject line and resume content, select the single best matching job opening from the list of available positions.

        Email Subject: {email_subject}
        Resume Snippet: {resume_text[:3000]}

        Available Positions:
        {json.dumps(job_profiles, indent=2)}

        Return your output strictly as a JSON object matching this structure:
        {{
            "matched_job_id": "<job_id_string_or_null>",
            "confidence_percentage": <number_from_0_to_100>,
            "reasoning": "<short_explanation>"
        }}
        If no available job matches the candidate's profile with at least 50% confidence, set "matched_job_id" to null.
        """

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        data = json.loads(response.choices[0].message.content)
        matched_id = data.get("matched_job_id")
        confidence = data.get("confidence_percentage", 0)

        logger.info("AI matching result for org %s: job_id=%s confidence=%s", org_id, matched_id, confidence)

        if matched_id and confidence >= 50:
            return next((j for j in active_jobs if str(j.id) == matched_id), None)

    except Exception:
        logger.exception("Failed to perform AI job matching for org %s", org_id)
        return None

    return None
