from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ats_migration import AtsIntegration, ImportAuditLog, ImportBatch, ImportBatchRow
from app.models.candidate import Candidate
from app.models.conversation import Conversation
from app.models.document import CandidateDocument
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.job_category import JobCategory
from app.models.message import Message
from app.models.note import Note
from app.models.stage import Stage
from app.schemas.canonical import CanonicalCandidate
from app.services.import_export_service import (
    candidate_name,
    link_candidate_to_job,
    upsert_canonical_candidate,
)
from app.services.migration.config_loader import get_path
from app.services.migration.message_content import (
    normalized_message_direction,
    parse_imported_message_timestamp,
    sanitize_imported_message_content,
)

ENTITY_ORDER = {
    "job": 0,
    "stage": 1,
    "candidate": 2,
    "application": 3,
    "interview": 4,
    "note": 5,
    "message": 6,
    "resume": 7,
}

UNCATEGORIZED_JOB_CATEGORY = "Uncategorized"

REQUIRED_ENTITY_FIELDS = {
    "job": ("external_job_id", "title"),
    "stage": ("external_stage_id", "name"),
    "application": (
        "external_application_id",
        "external_candidate_id",
        "external_job_id",
    ),
    "resume": ("external_document_id", "external_candidate_id"),
    "interview": (
        "external_interview_id",
        "external_candidate_id",
        "external_job_id",
        "scheduled_at",
    ),
    "note": ("external_note_id", "external_candidate_id", "content"),
    "message": ("provider_message_id", "external_candidate_id"),
}


def _set_row_result(
    row: ImportBatchRow,
    status: str,
    record_id: UUID | None = None,
    reason: str | None = None,
) -> None:
    row.result_status = status
    row.result_record_id = record_id
    row.result_reason = reason


def _coerce_stage_position(value: Any, fallback: int) -> int:
    if value in (None, ""):
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_application_status(value: Any) -> str:
    """Map provider-specific application labels to the internal status enum."""
    if isinstance(value, dict):
        value = value.get("name") or value.get("label") or value.get("value")
    normalized = str(value or "").strip().lower()
    if normalized in {"submitted", "in_review", "rejected", "hired"}:
        return normalized
    if any(term in normalized for term in ("hire", "onboard", "accepted")):
        return "hired"
    if any(term in normalized for term in ("reject", "declin", "withdraw", "disqualif")):
        return "rejected"
    if any(term in normalized for term in ("review", "screen", "interview", "assessment", "offer")):
        return "in_review"
    return "submitted"


def _display_text(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        return next((text for item in value if (text := _display_text(item))), "")
    if isinstance(value, dict):
        value = value.get("label") or value.get("name") or value.get("title") or value.get("value")
    return str(value).strip() if value not in (None, "") else ""


def _normalize_job_category(value: Any) -> str:
    return " ".join(_display_text(value).split())[:50]


def _normalize_country(value: Any) -> str | None:
    country = _display_text(value).upper()
    return country if len(country) == 2 and country.isalpha() else None


def _normalize_workplace_type(value: Any) -> str | None:
    if isinstance(value, bool):
        return "remote" if value else "onsite"
    normalized = _display_text(value).lower().replace("-", "_").replace(" ", "_")
    if normalized in {"onsite", "on_site", "office"}:
        return "onsite"
    if normalized in {"remote", "telecommuting"}:
        return "remote"
    if normalized == "hybrid":
        return "hybrid"
    return None


async def _get_or_create_job_category(
    db: AsyncSession, org_id: UUID, name: str
) -> JobCategory:
    """Return a category for an imported job without racing concurrent syncs."""
    await db.execute(
        pg_insert(JobCategory)
        .values(org_id=org_id, name=name, is_system_default=False)
        .on_conflict_do_nothing(constraint="uq_job_categories_org_name")
    )
    return (await db.execute(select(JobCategory).where(
        JobCategory.org_id == org_id,
        JobCategory.name == name,
    ))).scalar_one()


async def _resolve_candidate_job(
    db: AsyncSession, batch: ImportBatch, payload: dict[str, Any]
) -> Job | None:
    external_job_id = payload.get("external_job_id")
    if external_job_id:
        return (await db.execute(select(Job).where(
            Job.org_id == batch.integration.org_id,
            Job.external_job_id == str(external_job_id),
        ))).scalar_one_or_none()
    shortcode = payload.get("external_job_shortcode")
    if not shortcode:
        return None
    for job_row in batch.rows:
        if job_row.entity_type != "job" or not job_row.mapped_payload:
            continue
        if str(job_row.mapped_payload.get("shortcode") or "") != str(shortcode):
            continue
        external_id = job_row.mapped_payload.get("external_job_id")
        if external_id:
            return (await db.execute(select(Job).where(
                Job.org_id == batch.integration.org_id,
                Job.external_job_id == str(external_id),
            ))).scalar_one_or_none()
    return None


async def _resolve_candidate_stage(
    db: AsyncSession, job: Job | None, payload: dict[str, Any]
) -> Stage | None:
    if job is None:
        return None
    external_stage_id = payload.get("external_stage_id")
    if external_stage_id:
        return (await db.execute(select(Stage).where(
            Stage.job_id == job.id,
            Stage.external_stage_id == str(external_stage_id),
        ))).scalar_one_or_none()
    stage_name = payload.get("external_stage_name")
    if stage_name:
        return (await db.execute(select(Stage).where(
            Stage.job_id == job.id,
            Stage.name == str(stage_name),
        ))).scalar_one_or_none()
    return None


async def _existing_candidate(
    db: AsyncSession, org_id: UUID, payload: CanonicalCandidate
) -> Candidate | None:
    filters = []
    if payload.external_candidate_id:
        filters.append(Candidate.external_candidate_id == payload.external_candidate_id)
    if payload.email:
        filters.append(Candidate.email == str(payload.email))
    if payload.phone:
        filters.append(Candidate.phone == payload.phone)
    if not filters:
        return None
    return (await db.execute(select(Candidate).where(
        Candidate.org_id == org_id, or_(*filters)
    ).limit(1))).scalar_one_or_none()


async def _upsert_candidate_application(
    db: AsyncSession,
    batch: ImportBatch,
    candidate: Candidate,
    job: Job,
    stage: Stage | None,
) -> tuple[JobApplication, bool]:
    external_candidate_id = candidate.external_candidate_id or str(candidate.id)
    external_job_id = job.external_job_id or str(job.id)
    external_application_id = f"{batch.integration.provider}:{external_candidate_id}:{external_job_id}"
    application = (await db.execute(select(JobApplication).where(
        JobApplication.org_id == batch.integration.org_id,
        JobApplication.external_application_id == external_application_id,
    ))).scalar_one_or_none()
    created = application is None
    if created:
        application = JobApplication(
            org_id=batch.integration.org_id,
            external_application_id=external_application_id,
            job_id=job.id,
            candidate_id=candidate.id,
            full_name=candidate.name,
            email=candidate.email,
            phone=candidate.phone,
        )
    application.job_id = job.id
    application.candidate_id = candidate.id
    application.stage_id = stage.id if stage else None
    application.full_name = candidate.name
    application.email = candidate.email
    application.phone = candidate.phone
    application.status = "submitted"
    db.add(application)
    await link_candidate_to_job(
        db, batch.integration.org_id, candidate, job.id,
        stage.id if stage else None, f"migration:{batch.integration.provider}",
    )
    await db.flush()
    return application, created


def _email_value(value: Any, fallback: str | None) -> str:
    if isinstance(value, list):
        value = next((item for item in value if item), None)
    if isinstance(value, dict):
        value = value.get("email") or value.get("address") or value.get("value")
    return str(value or fallback or "").strip()[:320]


async def _upsert_imported_message(
    db: AsyncSession,
    batch: ImportBatch,
    payload: dict[str, Any],
) -> tuple[Message, bool]:
    """Put source communications into the existing per-candidate conversation."""
    candidate = (
        await db.execute(
            select(Candidate).where(
                Candidate.org_id == batch.integration.org_id,
                Candidate.external_candidate_id
                == str(payload.get("external_candidate_id")),
            )
        )
    ).scalar_one_or_none()
    if candidate is None:
        raise ValueError("References an unavailable candidate")

    source_provider = str(batch.integration.provider or "external_ats")[:80]
    provider_message_id = str(payload["provider_message_id"])[:500]
    existing = (
        await db.execute(
            select(Message).where(
                Message.org_id == batch.integration.org_id,
                Message.source_provider == source_provider,
                Message.provider_message_id == provider_message_id,
            )
        )
    ).scalar_one_or_none()

    from_email = _email_value(
        payload.get("sender_email") or payload.get("from_email"),
        candidate.email if payload.get("direction") == "inbound" else f"{source_provider}@imported.invalid",
    )
    direction = normalized_message_direction(
        payload.get("direction"), from_email, candidate.email or ""
    )
    to_email = _email_value(
        payload.get("recipient_email") or payload.get("to_email"),
        f"{source_provider}@imported.invalid" if direction == "inbound" else candidate.email,
    )
    if direction == "inbound" and not from_email:
        from_email = candidate.email[:320]
    if direction == "outbound" and not to_email:
        to_email = candidate.email[:320]

    body, html_body = sanitize_imported_message_content(
        payload.get("body_text") or payload.get("body"),
        payload.get("body_html") or payload.get("html_body"),
    )
    if not body and not html_body:
        raise ValueError("Message body is required")
    try:
        sent_at = parse_imported_message_timestamp(
            payload.get("sent_at") or payload.get("created_at") or payload.get("timestamp")
        )
    except (TypeError, ValueError, OverflowError, OSError) as exc:
        raise ValueError("sent_at must be a valid timestamp") from exc

    subject = str(payload.get("subject") or "").strip()[:1000]
    conversation = (
        await db.execute(
            select(Conversation).where(
                Conversation.org_id == batch.integration.org_id,
                Conversation.candidate_id == candidate.id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(
            org_id=batch.integration.org_id,
            candidate_id=candidate.id,
            job_id=candidate.job_id,
            subject=subject or f"Imported history with {candidate.name}"[:1000],
            channel="email",
            status="open",
            last_message_at=sent_at,
            created_at=sent_at,
        )
        db.add(conversation)
        await db.flush()
    elif conversation.job_id is None and candidate.job_id is not None:
        conversation.job_id = candidate.job_id

    target = existing or Message(
        org_id=batch.integration.org_id,
        conversation_id=conversation.id,
        source_provider=source_provider,
        provider_message_id=provider_message_id,
    )
    target.conversation_id = conversation.id
    target.direction = direction
    target.sender_type = "candidate" if direction == "inbound" else "user"
    target.sender_user_id = None
    target.from_email = from_email
    target.to_email = to_email
    target.subject = subject or None
    target.body = body
    target.html_body = html_body
    target.status = "received" if direction == "inbound" else "sent"
    target.email_message_id = _email_value(payload.get("email_message_id"), "") or None
    target.in_reply_to = _email_value(payload.get("in_reply_to"), "") or None
    target.references_header = str(payload.get("references_header") or "").strip() or None
    target.created_at = sent_at
    db.add(target)
    if conversation.last_message_at is None or sent_at > conversation.last_message_at:
        conversation.last_message_at = sent_at
    await db.flush()
    return target, existing is not None


async def create_pending_batch(
    db: AsyncSession,
    integration: AtsIntegration,
    raw_records: Iterable[dict[str, Any]] | dict[str, Iterable[dict[str, Any]]],
    source: str,
) -> ImportBatch:
    bundles = raw_records if isinstance(raw_records, dict) else {"candidate": raw_records}
    warnings = [
        str(warning)[:1000]
        for warning in bundles.get("__warnings", [])
        if str(warning).strip()
    ]
    batch = ImportBatch(
        integration_id=integration.id,
        source=source,
        status="pending_approval",
        entity_counts={},
        warnings=warnings,
    )
    db.add(batch)
    await db.flush()
    entity_counts: dict[str, int | str] = {}
    for entity_type in (
        "job",
        "stage",
        "candidate",
        "application",
        "resume",
        "interview",
        "note",
        "message",
    ):
      records = bundles.get(entity_type)
      if records is None:
          entity_counts[entity_type] = "unavailable"
          continue
      entity_counts[entity_type] = 0
      mapping = (integration.field_mapping_config or {}).get(entity_type, {})
      for row_number, raw in enumerate(records, start=1):
        entity_counts[entity_type] += 1
        row_status = "valid"
        error_reason = None
        mapped: dict[str, Any] | None = None
        matched_id = None
        try:
            values = {field: get_path(raw, path) for field, path in mapping.items()} if mapping else raw
            if entity_type != "candidate":
                missing = [
                    field for field in REQUIRED_ENTITY_FIELDS[entity_type]
                    if values.get(field) in (None, "")
                ]
                if missing:
                    raise ValueError(f"{', '.join(missing)} is required")
                if entity_type == "resume" and not (
                    values.get("source_url") or values.get("content_base64")
                ):
                    raise ValueError("source_url or content_base64 is required")
                mapped = values
                db.add(ImportBatchRow(batch_id=batch.id, raw_payload=raw, mapped_payload=mapped, entity_type=entity_type, row_status="valid", row_number=row_number))
                batch.total_rows += 1
                batch.valid_rows += 1
                continue
            candidate = CanonicalCandidate.model_validate(values)
            if not candidate.email and not candidate.phone:
                raise ValueError("email or phone is required")
            mapped = candidate.model_dump(mode="json")
            existing_external_id = None
            if candidate.external_candidate_id:
                existing_external_id = (await db.execute(select(Candidate.id).where(
                    Candidate.org_id == integration.org_id,
                    Candidate.external_candidate_id == candidate.external_candidate_id,
                ).limit(1))).scalar_one_or_none()
            if existing_external_id is None:
                filters = []
                if candidate.email:
                    filters.append(Candidate.email == str(candidate.email))
                if candidate.phone:
                    filters.append(Candidate.phone == candidate.phone)
                if filters:
                    matched_id = (await db.execute(select(Candidate.id).where(
                        Candidate.org_id == integration.org_id,
                        Candidate.is_pending_duplicate_review.is_(False),
                        or_(*filters),
                    ).limit(1))).scalar_one_or_none()
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
    batch.entity_counts = entity_counts
    await db.commit()
    return batch


async def commit_batch(
    db: AsyncSession, batch: ImportBatch, actor_id: UUID, audit_metadata: dict[str, Any] | None = None
) -> dict[str, int]:
    # The approval endpoint marks the batch as queued before Temporal starts the activity.
    if batch.status not in {"pending_approval", "approval_queued", "failed"}:
        raise ValueError(f"batch is already {batch.status}")
    committed_clean = 0
    committed_duplicates = 0
    unresolved_errors = 0
    stage_positions_by_job: dict[UUID, set[int]] = {}

    async def used_stage_positions(job_id: UUID) -> set[int]:
        positions = stage_positions_by_job.get(job_id)
        if positions is None:
            positions = set((await db.execute(
                select(Stage.position).where(Stage.job_id == job_id)
            )).scalars().all())
            stage_positions_by_job[job_id] = positions
        return positions

    for row in sorted(batch.rows, key=lambda item: (ENTITY_ORDER.get(item.entity_type, 99), item.row_number)):
        if row.row_status == "error":
            unresolved_errors += 1
            _set_row_result(row, "skipped", reason=row.error_reason)
            continue
        if not row.mapped_payload:
            raise ValueError(f"row {row.row_number} has no mapped payload")
        if row.entity_type != "candidate":
            payload = row.mapped_payload
            if row.entity_type == "job":
                existing = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                target = existing or Job(
                    org_id=batch.integration.org_id,
                    created_by_user_id=actor_id,
                    external_job_id=str(payload["external_job_id"]),
                )
                if target.created_by_user_id is None:
                    target.created_by_user_id = actor_id
                title = _display_text(payload.get("title"))
                if not title:
                    unresolved_errors += 1
                    _set_row_result(row, "skipped", reason="Job title is required")
                    continue
                target.title = title
                target.description = payload.get("description")
                # Do not overwrite a category or location a recruiter set in Otter
                # when the source omits it. New source jobs with no classification
                # are explicitly placed in Uncategorized rather than showing a dash.
                source_category = _normalize_job_category(payload.get("category"))
                category_name = source_category or (
                    UNCATEGORIZED_JOB_CATEGORY if not target.category else ""
                )
                if category_name:
                    category = await _get_or_create_job_category(
                        db, batch.integration.org_id, category_name
                    )
                    target.category = category.name
                    target.category_id = category.id
                city = _display_text(payload.get("city"))[:255]
                if city:
                    target.city = city
                country = _normalize_country(payload.get("country"))
                if country:
                    target.country = country
                workplace_type = _normalize_workplace_type(payload.get("workplace_type"))
                if workplace_type:
                    target.workplace_type = workplace_type
                db.add(target)
                await db.flush()
                _set_row_result(
                    row, "updated" if existing else "created", target.id,
                    "Job updated" if existing else "Job created",
                )
            elif row.entity_type == "stage":
                external_job_id = payload.get("external_job_id")
                if external_job_id:
                    jobs = (await db.execute(select(Job).where(
                        Job.org_id == batch.integration.org_id,
                        Job.external_job_id == str(external_job_id),
                    ))).scalars().all()
                else:
                    # Workable stages are account-level, so apply them to jobs in this batch.
                    imported_job_ids = {
                        str(job_row.mapped_payload.get("external_job_id"))
                        for job_row in batch.rows
                        if job_row.entity_type == "job"
                        and job_row.mapped_payload
                        and job_row.mapped_payload.get("external_job_id")
                    }
                    jobs = (await db.execute(select(Job).where(
                        Job.org_id == batch.integration.org_id,
                        Job.external_job_id.in_(imported_job_ids),
                    ))).scalars().all() if imported_job_ids else []
                if not jobs:
                    unresolved_errors += 1
                    _set_row_result(row, "skipped", reason="No imported job matched this stage")
                    continue
                stage_results = []
                for job in jobs:
                    existing = (await db.execute(select(Stage).where(
                        Stage.job_id == job.id,
                        Stage.external_stage_id == str(payload.get("external_stage_id")),
                    ))).scalar_one_or_none()
                    if existing:
                        target = existing
                    else:
                        positions = await used_stage_positions(job.id)
                        position = _coerce_stage_position(payload.get("position"), row.row_number)
                        if position < 0:
                            position = row.row_number
                        while position in positions:
                            position += 1
                        positions.add(position)
                        target = Stage(
                            org_id=batch.integration.org_id,
                            job_id=job.id,
                            external_stage_id=str(payload["external_stage_id"]),
                            position=position,
                        )
                    target.name = str(payload["name"])
                    db.add(target)
                    await db.flush()
                    stage_results.append((target, existing is not None, job.title))
                _set_row_result(
                    row,
                    "updated" if all(updated for _, updated, _ in stage_results) else "created",
                    stage_results[0][0].id,
                    f"Stage {('updated' if all(updated for _, updated, _ in stage_results) else 'created')} for {len(stage_results)} job(s)",
                )
                committed_clean += 1
                continue
            elif row.entity_type == "application":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                job = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                if not candidate or not job:
                    missing = ", ".join(
                        name for name, value in (("candidate", candidate), ("job", job)) if value is None
                    )
                    unresolved_errors += 1
                    _set_row_result(
                        row,
                        "skipped",
                        reason=f"References unavailable {missing}",
                    )
                    continue
                target = (await db.execute(select(JobApplication).where(JobApplication.org_id == batch.integration.org_id, JobApplication.external_application_id == str(payload["external_application_id"])))).scalar_one_or_none()
                if not target:
                    target = JobApplication(org_id=batch.integration.org_id, external_application_id=str(payload["external_application_id"]), job_id=job.id, candidate_id=candidate.id, full_name=candidate.name, email=candidate.email)
                    application_created = True
                else:
                    application_created = False
                target.stage_id = (await db.execute(select(Stage.id).where(Stage.job_id == job.id, Stage.external_stage_id == str(payload.get("external_stage_id"))))).scalar_one_or_none()
                target.status = _normalize_application_status(payload.get("status"))
                await link_candidate_to_job(
                    db,
                    batch.integration.org_id,
                    candidate,
                    job.id,
                    target.stage_id,
                    f"migration:{batch.integration.provider}",
                )
                db.add(target)
                await db.flush()
                _set_row_result(row, "created" if application_created else "updated", target.id, "Application imported")
            elif row.entity_type == "interview":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                job = (await db.execute(select(Job).where(Job.org_id == batch.integration.org_id, Job.external_job_id == str(payload.get("external_job_id"))))).scalar_one_or_none()
                if not candidate or not job:
                    missing = ", ".join(
                        name for name, value in (("candidate", candidate), ("job", job)) if value is None
                    )
                    unresolved_errors += 1
                    _set_row_result(
                        row,
                        "skipped",
                        reason=f"References unavailable {missing}",
                    )
                    continue
                existing = (await db.execute(select(Interview).where(Interview.org_id == batch.integration.org_id, Interview.external_interview_id == str(payload["external_interview_id"])))).scalar_one_or_none()
                target = existing or Interview(org_id=batch.integration.org_id, external_interview_id=str(payload["external_interview_id"]), job_id=job.id, candidate_id=candidate.id, scheduled_at=datetime.fromisoformat(str(payload["scheduled_at"]).replace("Z", "+00:00")))
                target.source_interviewer_name = payload.get("interviewer_name")
                target.duration_minutes = payload.get("duration_minutes")
                db.add(target)
                await db.flush()
                _set_row_result(row, "updated" if existing else "created", target.id, "Interview imported")
            elif row.entity_type == "note":
                candidate = (await db.execute(select(Candidate).where(Candidate.org_id == batch.integration.org_id, Candidate.external_candidate_id == str(payload.get("external_candidate_id"))))).scalar_one_or_none()
                if not candidate:
                    unresolved_errors += 1
                    _set_row_result(
                        row,
                        "skipped",
                        reason="References an unavailable candidate",
                    )
                    continue
                existing = (await db.execute(select(Note).where(Note.org_id == batch.integration.org_id, Note.external_note_id == str(payload["external_note_id"])))).scalar_one_or_none()
                target = existing or Note(org_id=batch.integration.org_id, external_note_id=str(payload["external_note_id"]), candidate_id=candidate.id, content=str(payload["content"]))
                target.source_author_name = payload.get("author_name")
                db.add(target)
                await db.flush()
                _set_row_result(row, "updated" if existing else "created", target.id, "Note imported")
            elif row.entity_type == "message":
                try:
                    target, existed = await _upsert_imported_message(db, batch, payload)
                except ValueError as exc:
                    unresolved_errors += 1
                    _set_row_result(row, "skipped", reason=str(exc))
                    continue
                _set_row_result(
                    row,
                    "updated" if existed else "created",
                    target.id,
                    f"Message imported from {batch.integration.provider}",
                )
            elif row.entity_type == "resume":
                # Binary transfer is performed by the following Temporal activity.
                _set_row_result(row, "created", reason="Resume queued for transfer")
                continue
            else:
                unresolved_errors += 1
                _set_row_result(row, "skipped", reason="Unsupported entity type")
                continue
            committed_clean += 1
            continue
        candidate_payload = dict(row.mapped_payload)
        candidate_for_lookup = CanonicalCandidate.model_validate(candidate_payload)
        candidate_job = await _resolve_candidate_job(db, batch, candidate_payload)
        candidate_stage = await _resolve_candidate_stage(db, candidate_job, candidate_payload)
        if candidate_job:
            candidate_payload["job_id"] = str(candidate_job.id)
        if candidate_stage:
            candidate_payload["stage_id"] = str(candidate_stage.id)
        candidate = CanonicalCandidate.model_validate(candidate_payload)
        existing_candidate = await _existing_candidate(db, batch.integration.org_id, candidate_for_lookup)
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
            duplicate_reason = "Candidate created and flagged as a potential duplicate"
            if candidate_job:
                application, application_created = await _upsert_candidate_application(
                    db, batch, saved, candidate_job, candidate_stage,
                )
                duplicate_reason += f"; application {'created' if application_created else 'updated'} ({application.id})"
            _set_row_result(row, "created", saved.id, duplicate_reason)
            committed_duplicates += 1
        else:
            saved = await upsert_canonical_candidate(db, batch.integration.org_id, candidate, f"migration:{batch.integration.provider}")
            application_note = None
            if candidate_job:
                application, application_created = await _upsert_candidate_application(
                    db, batch, saved, candidate_job, candidate_stage,
                )
                application_note = f"Application {'created' if application_created else 'updated'} ({application.id})"
            _set_row_result(
                row,
                "updated" if existing_candidate else "created",
                saved.id,
                "; ".join(filter(None, [
                    "Candidate updated" if existing_candidate else "Candidate created",
                    f"linked to job {candidate_job.title}" if candidate_job else "No job association in source payload",
                    application_note,
                ])),
            )
            committed_clean += 1
    committed = committed_clean + committed_duplicates
    batch.status = "completed" if not unresolved_errors else "completed_with_flags"
    batch.error_reason = None
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
            elif row.entity_type == "message" and payload.get("provider_message_id"):
                existing = (await db.execute(
                    select(Message).where(
                        Message.org_id == org_id,
                        Message.source_provider == batch.integration.provider,
                        Message.provider_message_id == str(payload["provider_message_id"]),
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
