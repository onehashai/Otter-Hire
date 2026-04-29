from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from temporalio import activity

from app.db.session import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.job import Job
from app.services.resume_scoring import score_candidate_against_job
from app.temporal.resume_scoring.types import ResumeScoreInput

logger = logging.getLogger("ats_worker")


@activity.defn(name="score_candidate_job_activity")
async def score_candidate_job_activity(input_data: ResumeScoreInput) -> dict:
    org_id = UUID(input_data.org_id)
    candidate_id = UUID(input_data.candidate_id)
    job_id = UUID(input_data.job_id)

    async with AsyncSessionLocal() as session:
        assignment_result = await session.execute(
            select(CandidateJobs).where(
                CandidateJobs.org_id == org_id,
                CandidateJobs.candidate_id == candidate_id,
                CandidateJobs.job_id == job_id,
            )
        )
        assignment = assignment_result.scalar_one_or_none()
        if assignment is None:
            return {"status": "failed", "reason": "assignment_not_found"}

        candidate_result = await session.execute(
            select(Candidate).where(Candidate.id == candidate_id, Candidate.org_id == org_id)
        )
        candidate = candidate_result.scalar_one_or_none()
        job_result = await session.execute(
            select(Job).where(Job.id == job_id, Job.org_id == org_id)
        )
        job = job_result.scalar_one_or_none()
        if candidate is None or job is None:
            assignment.resume_score = None
            assignment.resume_score_status = "failed"
            assignment.resume_score_sections = {}
            await session.commit()
            return {"status": "failed", "reason": "candidate_or_job_missing"}

        if int(assignment.resume_score_generation or 0) != input_data.generation:
            return {
                "status": "skipped",
                "reason": "superseded_before_compute",
                "generation": input_data.generation,
            }

        result = await score_candidate_against_job(
            parsed_resume=candidate.parsed_resume
            if isinstance(candidate.parsed_resume, dict)
            else None,
            job_title=job.title,
            job_description=job.description,
            category=job.category,
            employment_type=job.employment_type,
            workplace_type=job.workplace_type,
        )
        await session.refresh(assignment)
        if int(assignment.resume_score_generation or 0) != input_data.generation:
            return {
                "status": "skipped",
                "reason": "superseded_after_compute",
                "generation": input_data.generation,
            }
        assignment.resume_score = result.score
        assignment.resume_score_status = result.status
        assignment.resume_score_sections = result.sections
        await session.commit()
        return {
            "status": result.status,
            "candidate_id": input_data.candidate_id,
            "job_id": input_data.job_id,
            "score": result.score,
            "generation": input_data.generation,
        }
