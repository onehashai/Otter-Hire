from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ats_migration import AtsIntegration, ImportAuditLog, ImportBatch, ImportBatchRow
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.note import Note
from app.models.stage import Stage
from app.schemas.canonical import CanonicalCandidate
from app.services.import_export_service import (
    candidate_name,
    link_candidate_to_job,
    upsert_canonical_candidate,
)
from app.services.migration.config_loader import get_path

ENTITY_ORDER = {
    "job": 0,
    "stage": 1,
    "candidate": 2,
    "application": 3,
    "resume": 4,
    "interview": 5,
    "note": 6,
}


async def create_pending_batch(
    db: AsyncSession,
    integration: AtsIntegration,
    raw_records: Iterable[dict[str, Any]] | dict[str, Iterable[dict[str, Any]]],
    source: str,
) -> ImportBatch:
    bundles = raw_records if isinstance(raw_records, dict) else {"candidate": raw_records}
    batch = ImportBatch(integration_id=integration.id, source=source, status="pending_approval", entity_counts={})
    db.add(batch)
    await db.flush()
    for entity_type in ("job", "stage", "candidate", "application", "resume", "interview", "note"):
      records = bundles.get(entity_type)
      if records is None:
          batch.entity_counts[entity_type] = "unavailable"
          continue
      batch.entity_counts[entity_type] = 0
      mapping = (integration.field_mapping_config or {}).get(entity_type, {})
      for row_number, raw in enumerate(records, start=1):
        batch.entity_counts[entity_type] += 1
        row_status = "valid"
        error_reason = None
        mapped: dict[str, Any] | None = None
        matched_id = None
        try:
            values = {field: get_path(raw, path) for field, path in mapping.items()} if mapping else raw
            if entity_type != "candidate":
                required = {"job": "title", "stage": "name", "application": "external_application_id", "resume": "external_document_id", "interview": "scheduled_at", "note": "content"}
                if not values.get(required[entity_type]):
                    raise ValueError(f"{required[entity_type]} is required")
                mapped = values
                db.add(ImportBatchRow(batch_id=batch.id, raw_payload=raw, mapped_payload=mapped, entity_type=entity_type, row_status="valid", row_number=row_number))
                batch.total_rows += 1
                batch.valid_rows += 1
                continue
            candidate = CanonicalCandidate.model_validate(values)
            if not candidate.email and not candidate.phone:
                raise ValueError("email or phone is required")
            mapped = candidate.model_dump(mode="json")
            filters = []
            if candidate.email:
                filters.append(Candidate.email == str(candidate.email))
            if candidate.phone:
                filters.append(Candidate.phone == candidate.phone)
            if filters:
                matched_id = (await db.execute(select(Candidate.id).where(Candidate.org_id == integration.org_id, Candidate.is_pending_duplicate_review.is_(False), or_(*filters)).limit(1))).scalar_one_or_none()
            if matched_id:
                row_status = "duplicate"
        except Exception as exc:
            row_status = "error"
            error_reason = str(exc)
        db.add(ImportBatchRow(
            batch_id=batch.id, raw_payload=raw, mapped_payload=mapped,
            row_status=row_status, error_reason=error_reason, matched_candidate_id=matched_id if row_status == "duplicate" else None, entity_type=entity_type, row_number=row_number,
        ))
        batch.total_rows += 1
        if row_status == "valid":
            batch.valid_rows += 1
        elif row_status == "duplicate":
            batch.flagged_rows += 1
        else:
            batch.error_rows += 1
    batch.entity_counts = dict(batch.entity_counts or {})
    await db.commit()
    return batch


async def commit_batch(
    db: AsyncSession, batch: ImportBatch, actor_id: UUID, audit_metadata: dict[str, Any] | None = None
) -> dict[str, int]:
    if batch.status != "pending_approval":
        raise ValueError(f"batch is already {batch.status}")
    committed_clean = 0
    committed_duplicates = 0
    unresolved_errors = 0
    for row in sorted(batch.rows, key=lambda item: (ENTITY_ORDER.get(item.entity_type, 99), item.row_number)):
        if row.row_status == "error":
            unresolved_errors += 1
            continue
        if not row.mapped_payload:
            raise ValueError(f"row {row.row_number} has no mapped payload")
        if row.entity_type != "candidate":
            payload = row.mapped_payload
            if row.entity_type == "job":
                existing = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                target = existing or Job(org_id=batch.integration.org_id, external_job_id=str(payload["external_job_id"]))
                target.title = str(payload["title"])
                target.description = payload.get("description")
                db.add(target)
                await db.flush()
            elif row.entity_type == "stage":
                job = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                if not job:
                    raise ValueError(f"row {row.row_number} references an unavailable job")
                existing = (await db.execute(select(Stage).where(Stage.job_id == job.id, Stage.external_stage_id == str(payload.get("external_stage_id"))))).scalar_one_or_none()
                target = existing or Stage(org_id=batch.integration.org_id, job_id=job.id, external_stage_id=str(payload["external_stage_id"]), position=int(payload.get("position", 0)))
                target.name = str(payload["name"])
                db.add(target)
                await db.flush()
            elif row.entity_type == "application":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                job = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                if not candidate or not job:
                    missing = ", ".join(
                        name for name, value in (("candidate", candidate), ("job", job)) if value is None
                    )
                    raise ValueError(f"row {row.row_number} references unavailable {missing}")
                target = (await db.execute(select(JobApplication).where(JobApplication.org_id == batch.integration.org_id, JobApplication.external_application_id == str(payload["external_application_id"])))).scalar_one_or_none()
                if not target:
                    target = JobApplication(org_id=batch.integration.org_id, external_application_id=str(payload["external_application_id"]), job_id=job.id, candidate_id=candidate.id, full_name=candidate.name, email=candidate.email)
                target.stage_id = (await db.execute(select(Stage.id).where(Stage.job_id == job.id, Stage.external_stage_id == str(payload.get("external_stage_id"))))).scalar_one_or_none()
                target.status = str(payload.get("status", "submitted"))
                await link_candidate_to_job(
                    db,
                    batch.integration.org_id,
                    candidate,
                    job.id,
                    target.stage_id,
                    f"migration:{batch.integration.provider}",
                )
                db.add(target)
            elif row.entity_type == "interview":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                job = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                if not candidate or not job:
                    missing = ", ".join(
                        name for name, value in (("candidate", candidate), ("job", job)) if value is None
                    )
                    raise ValueError(f"row {row.row_number} references unavailable {missing}")
                existing = (await db.execute(select(Interview).where(Interview.org_id == batch.integration.org_id, Interview.external_interview_id == str(payload["external_interview_id"])))).scalar_one_or_none()
                target = existing or Interview(org_id=batch.integration.org_id, external_interview_id=str(payload["external_interview_id"]), job_id=job.id, candidate_id=candidate.id, scheduled_at=datetime.fromisoformat(str(payload["scheduled_at"]).replace("Z", "+00:00")))
                target.source_interviewer_name = payload.get("interviewer_name")
                target.duration_minutes = payload.get("duration_minutes")
                db.add(target)
            elif row.entity_type == "note":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                if not candidate:
                    raise ValueError(f"row {row.row_number} references an unavailable candidate")
                existing = (await db.execute(select(Note).where(Note.org_id == batch.integration.org_id, Note.external_note_id == str(payload["external_note_id"])))).scalar_one_or_none()
                target = existing or Note(org_id=batch.integration.org_id, external_note_id=str(payload["external_note_id"]), candidate_id=candidate.id, content=str(payload["content"]))
                target.source_author_name = payload.get("author_name")
                db.add(target)
            elif row.entity_type == "resume":
                # Binary transfer is performed by the following Temporal activity.
                continue
            else:
                unresolved_errors += 1
                continue
            committed_clean += 1
            continue
        candidate = CanonicalCandidate.model_validate(row.mapped_payload)
        if row.row_status == "duplicate":
            if not row.matched_candidate_id:
                raise ValueError(f"row {row.row_number} is duplicate but has no original candidate")
            saved = Candidate(
                org_id=batch.integration.org_id,
                external_candidate_id=candidate.external_candidate_id,
                job_id=candidate.job_id,
                stage_id=candidate.stage_id,
                status="active",
                name=candidate_name(candidate),
                email=str(candidate.email or ""),
                phone=candidate.phone,
                source=f"migration:{batch.integration.provider}",
                tags=candidate.skills,
                parsed_resume={"resume_text": candidate.resume_text, **candidate.custom_fields},
                is_pending_duplicate_review=True,
                possible_duplicate_of_id=row.matched_candidate_id,
            )
            db.add(saved)
            await db.flush()
            if candidate.job_id:
                await link_candidate_to_job(db, batch.integration.org_id, saved, candidate.job_id, candidate.stage_id, saved.source)
            committed_duplicates += 1
        else:
            await upsert_canonical_candidate(db, batch.integration.org_id, candidate, f"migration:{batch.integration.provider}")
            committed_clean += 1
    committed = committed_clean + committed_duplicates
    batch.status = "completed" if not unresolved_errors else "completed_with_flags"
    batch.approved_by = actor_id
    batch.approved_at = datetime.now(timezone.utc)
    batch.integration.last_synced_at = datetime.now(timezone.utc)
    db.add(ImportAuditLog(
        batch_id=batch.id, actor_id=actor_id, action="approved",
        metadata_json={
            "committed_clean": committed_clean,
            "committed_potential_duplicates": committed_duplicates,
            "unresolved_errors": unresolved_errors,
            **(audit_metadata or {}),
        },
    ))
    await db.commit()
    return {
        "committed": committed,
        "committed_clean": committed_clean,
        "committed_duplicates": committed_duplicates,
        "unresolved_errors": unresolved_errors,
        "excluded": unresolved_errors,
    }


async def preview_batch(db: AsyncSession, batch: ImportBatch) -> dict[str, Any]:
    """Calculate commit outcomes without changing database state."""
    rows = []
    totals = {"created": 0, "updated": 0, "skipped": 0}
    org_id = batch.integration.org_id
    for row in sorted(batch.rows, key=lambda item: (ENTITY_ORDER.get(item.entity_type, 99), item.row_number)):
        payload = row.mapped_payload or {}
        if row.row_status == "error" or not payload:
            outcome, reason, matched = "skipped", row.error_reason or "No mapped payload", None
        else:
            matched = None
            existing = None
            if row.entity_type == "candidate" and row.row_status == "duplicate":
                matched = row.matched_candidate_id
                outcome, reason = "created", "New candidate will be created and flagged as a potential duplicate"
                totals[outcome] += 1
                rows.append({
                    "row_id": row.id, "row_number": row.row_number, "entity_type": row.entity_type,
                    "current_status": row.row_status, "outcome": outcome, "reason": reason,
                    "matched_record_id": matched,
                })
                continue
            if row.entity_type == "job" and payload.get("external_job_id"):
                existing = (await db.execute(select(Job).where(Job.org_id == org_id, Job.external_job_id == str(payload["external_job_id"])))).scalar_one_or_none()
            elif row.entity_type == "stage" and payload.get("external_stage_id"):
                existing = (await db.execute(select(Stage).where(Stage.org_id == org_id, Stage.external_stage_id == str(payload["external_stage_id"])))).scalar_one_or_none()
            elif row.entity_type == "candidate":
                filters = []
                if payload.get("external_candidate_id"):
                    filters.append(Candidate.external_candidate_id == str(payload["external_candidate_id"]))
                if payload.get("email"):
                    filters.append(Candidate.email == str(payload["email"]))
                if payload.get("phone"):
                    filters.append(Candidate.phone == str(payload["phone"]))
                if filters:
                    existing = (await db.execute(select(Candidate).where(Candidate.org_id == org_id, or_(*filters)).limit(1))).scalar_one_or_none()
            elif row.entity_type == "application" and payload.get("external_application_id"):
                existing = (await db.execute(select(JobApplication).where(JobApplication.org_id == org_id, JobApplication.external_application_id == str(payload["external_application_id"])))).scalar_one_or_none()
            elif row.entity_type == "resume" and payload.get("external_document_id"):
                existing = (await db.execute(select(CandidateDocument).where(CandidateDocument.org_id == org_id, CandidateDocument.external_document_id == str(payload["external_document_id"])))).scalar_one_or_none()
            elif row.entity_type == "interview" and payload.get("external_interview_id"):
                existing = (await db.execute(select(Interview).where(Interview.org_id == org_id, Interview.external_interview_id == str(payload["external_interview_id"])))).scalar_one_or_none()
            elif row.entity_type == "note" and payload.get("external_note_id"):
                existing = (await db.execute(
                    select(Note).where(
                        Note.org_id == org_id,
                        Note.external_note_id == str(payload["external_note_id"]),
                    )
                )).scalar_one_or_none()
            if existing:
                matched = existing.id
                outcome, reason = "updated", "Existing external record will be upserted"
            else:
                outcome, reason = "created", None
        totals[outcome] += 1
        rows.append({
            "row_id": row.id, "row_number": row.row_number, "entity_type": row.entity_type,
            "current_status": row.row_status, "outcome": outcome, "reason": reason,
            "matched_record_id": matched,
        })
    return {"batch_id": batch.id, "batch_status": batch.status, **totals, "rows": rows}


async def reject_batch(db: AsyncSession, batch: ImportBatch, actor_id: UUID) -> None:
    if batch.status != "pending_approval":
        raise ValueError(f"batch is already {batch.status}")
    batch.status = "rejected"
    batch.approved_by = actor_id
    batch.approved_at = datetime.now(timezone.utc)
    db.add(ImportAuditLog(batch_id=batch.id, actor_id=actor_id, action="rejected", metadata_json={}))
    await db.commit()
