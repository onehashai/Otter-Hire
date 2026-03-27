"""Temporal activities: post–job-apply resume parsing."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from temporalio import activity

from app.temporal.resume_parsing.types import JobApplyResumeParseInput

logger = logging.getLogger("ats_worker")


@activity.defn(name="parse_job_apply_resume_activity")
async def parse_job_apply_resume_activity(input_data: JobApplyResumeParseInput) -> dict:
    from sqlalchemy import select

    from app.db.session import AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.services.resume.pipeline import run_resume_pipeline
    from app.services.storage import storage_service

    org_id = UUID(input_data.org_id)
    candidate_id = UUID(input_data.candidate_id)
    mime_primary = (input_data.mime.split(";")[0].strip() if input_data.mime else "application/octet-stream")

    try:
        content = await storage_service.read_bytes(input_data.object_key)
    except Exception:
        logger.exception(
            "parse_job_apply_resume: storage read failed key=%s candidate_id=%s",
            input_data.object_key,
            input_data.candidate_id,
        )
        return {"status": "failed", "reason": "storage_read"}

    try:
        result = await asyncio.to_thread(
            run_resume_pipeline,
            input_data.resume_display_name,
            mime_primary,
            content,
            fallback_email=input_data.fallback_email,
        )
    except Exception:
        logger.exception(
            "parse_job_apply_resume: run_resume_pipeline failed candidate_id=%s",
            input_data.candidate_id,
        )
        return {"status": "failed", "reason": "parse"}

    async with AsyncSessionLocal() as session:
        row = await session.execute(
            select(Candidate).where(Candidate.id == candidate_id, Candidate.org_id == org_id)
        )
        cand = row.scalar_one_or_none()
        if not cand:
            logger.warning(
                "parse_job_apply_resume: candidate missing candidate_id=%s org_id=%s",
                candidate_id,
                org_id,
            )
            return {"status": "failed", "reason": "candidate_not_found"}

        cand.parsed_resume = result.profile.model_dump(mode="json")
        await session.commit()

    return {
        "status": "ok",
        "parse_method": result.parse_method,
        "candidate_id": str(candidate_id),
    }
