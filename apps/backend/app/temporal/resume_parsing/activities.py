"""Temporal activities: post–job-apply resume parsing."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from uuid import UUID

from temporalio import activity

from app.temporal.resume_parsing.types import JobApplyResumeParseInput
from app.temporal.resume_scoring.queue import enqueue_resume_score
from app.temporal.resume_scoring.types import ResumeScoreInput

logger = logging.getLogger("ats_worker")

_CACHE_PREFIX = "ats:resume:parse:"


def _cache_ttl() -> int:
    from app.core.config import settings

    return 60 * 60 * 24 * settings.resume_parse_cache_ttl_days


async def _get_cached_profile_json(content_hash: str) -> str | None:
    """Return cached JSON string for this resume hash, or None on miss/error."""
    try:
        from app.core.redis_client import get_redis_client

        client = get_redis_client()
        return await client.get(f"{_CACHE_PREFIX}{content_hash}")
    except Exception:
        return None


async def _set_cached_profile_json(content_hash: str, profile_json: str) -> None:
    """Store parsed profile JSON in Redis with 30-day TTL. Fails silently."""
    try:
        from app.core.redis_client import get_redis_client

        client = get_redis_client()
        await client.setex(f"{_CACHE_PREFIX}{content_hash}", _cache_ttl(), profile_json)
    except Exception:
        pass


@activity.defn(name="parse_job_apply_resume_activity")
async def parse_job_apply_resume_activity(input_data: JobApplyResumeParseInput) -> dict:
    from sqlalchemy import select

    from app.db.session import AsyncSessionLocal
    from app.models.candidate import Candidate
    from app.models.candidate_jobs import CandidateJobs
    from app.services.resume.canonical import ResumeProfile
    from app.services.resume.pipeline import run_resume_pipeline
    from app.services.storage import storage_service

    org_id = UUID(input_data.org_id)
    candidate_id = UUID(input_data.candidate_id)
    mime_primary = (
        input_data.mime.split(";")[0].strip() if input_data.mime else "application/octet-stream"
    )

    try:
        content = await storage_service.read_bytes(input_data.object_key)
    except Exception:
        logger.exception(
            "parse_job_apply_resume: storage read failed key=%s candidate_id=%s",
            input_data.object_key,
            input_data.candidate_id,
        )
        return {"status": "failed", "reason": "storage_read"}

    # --- Content-hash cache check ---
    content_hash = hashlib.sha256(content).hexdigest()
    cached_json = await _get_cached_profile_json(content_hash)

    if cached_json:
        logger.info(
            "parse_job_apply_resume: cache hit hash=%s candidate_id=%s",
            content_hash[:12],
            input_data.candidate_id,
        )
        try:
            profile = ResumeProfile.model_validate_json(cached_json)
            async with AsyncSessionLocal() as session:
                row = await session.execute(
                    select(Candidate).where(
                        Candidate.id == candidate_id, Candidate.org_id == org_id
                    )
                )
                cand = row.scalar_one_or_none()
                if not cand:
                    return {"status": "failed", "reason": "candidate_not_found"}
                cand.parsed_resume = profile.model_dump(mode="json")
                assignment_rows = await session.execute(
                    select(CandidateJobs).where(
                        CandidateJobs.org_id == org_id,
                        CandidateJobs.candidate_id == candidate_id,
                        CandidateJobs.assignment_status != "withdrawn",
                    )
                )
                assignments = assignment_rows.scalars().all()
                for assignment in assignments:
                    assignment.resume_score = None
                    assignment.resume_score_status = "pending"
                    assignment.resume_score_sections = None
                    assignment.resume_score_generation = (
                        int(assignment.resume_score_generation or 0) + 1
                    )
                await session.commit()
                for assignment in assignments:
                    await enqueue_resume_score(
                        ResumeScoreInput(
                            org_id=input_data.org_id,
                            candidate_id=input_data.candidate_id,
                            job_id=str(assignment.job_id),
                            generation=int(assignment.resume_score_generation or 0),
                        )
                    )
            return {"status": "ok", "parse_method": "cache", "candidate_id": str(candidate_id)}
        except Exception:
            logger.warning(
                "parse_job_apply_resume: cache entry invalid, re-parsing candidate_id=%s",
                input_data.candidate_id,
            )

    # --- Full pipeline ---
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
        assignment_rows = await session.execute(
            select(CandidateJobs).where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.candidate_id == candidate_id,
                CandidateJobs.assignment_status != "withdrawn",
            )
        )
        assignments = assignment_rows.scalars().all()
        for assignment in assignments:
            assignment.resume_score = None
            assignment.resume_score_status = "pending"
            assignment.resume_score_sections = None
            assignment.resume_score_generation = int(assignment.resume_score_generation or 0) + 1
        await session.commit()
    for assignment in assignments:
        await enqueue_resume_score(
            ResumeScoreInput(
                org_id=input_data.org_id,
                candidate_id=input_data.candidate_id,
                job_id=str(assignment.job_id),
                generation=int(assignment.resume_score_generation or 0),
            )
        )

    # Store in cache for future duplicate uploads (fire-and-forget)
    await _set_cached_profile_json(content_hash, result.profile.model_dump_json())

    return {
        "status": "ok",
        "parse_method": result.parse_method,
        "candidate_id": str(candidate_id),
    }
