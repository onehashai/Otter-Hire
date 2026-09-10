from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.job import Job
from app.schemas.canonical import CanonicalCandidate, ImportRowError, ImportSummary
from app.utils.uuid import uuid7


def candidate_name(candidate: CanonicalCandidate) -> str:
    return " ".join(part for part in (candidate.first_name, candidate.last_name) if part).strip() or "Unnamed candidate"


async def upsert_canonical_candidate(
    db: AsyncSession, org_id: UUID, payload: CanonicalCandidate, source: str = "import"
) -> Candidate:
    filters = [Candidate.external_candidate_id == payload.external_candidate_id] if payload.external_candidate_id else []
    if payload.email:
        filters.append(Candidate.email == payload.email)
    if payload.phone:
        filters.append(Candidate.phone == payload.phone)
    result = await db.execute(
        select(Candidate).where(Candidate.org_id == org_id, or_(*filters)) if filters
        else select(Candidate).where(False)
    )
    candidate = result.scalars().first()
    incoming_skills = payload.skills
    if candidate is None:
        candidate = Candidate(
            id=uuid7(), org_id=org_id, status="active", name=candidate_name(payload),
            external_candidate_id=payload.external_candidate_id,
            email=payload.email or "", phone=payload.phone, source=source,
            tags=incoming_skills, parsed_resume={"resume_text": payload.resume_text, **payload.custom_fields},
        )
        db.add(candidate)
    else:
        if payload.email:
            candidate.email = payload.email
        if payload.phone:
            candidate.phone = payload.phone
        candidate.name = candidate_name(payload) if candidate_name(payload) != "Unnamed candidate" else candidate.name
        candidate.source = source or candidate.source
        existing = set(candidate.tags or [])
        candidate.tags = list(dict.fromkeys([*existing, *incoming_skills]))
        resume = dict(candidate.parsed_resume or {})
        if payload.resume_text:
            resume["resume_text"] = payload.resume_text
        resume.update(payload.custom_fields)
        candidate.parsed_resume = resume
    await db.flush()
    if payload.job_id:
        await link_candidate_to_job(db, org_id, candidate, payload.job_id, payload.stage_id, source)
    return candidate


async def link_candidate_to_job(
    db: AsyncSession, org_id: UUID, candidate: Candidate, job_id: UUID, stage_id: UUID | None = None,
    source: str = "import",
) -> CandidateJobs:
    job = (await db.execute(select(Job).where(Job.id == job_id, Job.org_id == org_id))).scalar_one_or_none()
    if job is None:
        raise ValueError("Job does not belong to this organization")
    assignment = (await db.execute(select(CandidateJobs).where(
        CandidateJobs.org_id == org_id, CandidateJobs.candidate_id == candidate.id, CandidateJobs.job_id == job_id
    ))).scalar_one_or_none()
    if assignment is None:
        assignment = CandidateJobs(org_id=org_id, candidate_id=candidate.id, job_id=job_id,
                                   stage_id=stage_id, source=source, assigned_at=datetime.now(timezone.utc))
        db.add(assignment)
    elif stage_id:
        assignment.stage_id = stage_id
    return assignment


async def import_candidates(
    db: AsyncSession, org_id: UUID, rows: Iterable[CanonicalCandidate], source: str = "import"
) -> ImportSummary:
    summary = ImportSummary()
    for row_number, payload in enumerate(rows, start=2):
        summary.total_processed += 1
        try:
            if not payload.email and not payload.phone:
                raise ValueError("email or phone is required")
            await upsert_canonical_candidate(db, org_id, payload, source)
            summary.successful += 1
        except Exception as exc:
            await db.rollback()
            summary.failed += 1
            summary.errors.append(ImportRowError(row=row_number, message=str(exc)))
    await db.commit()
    return summary
