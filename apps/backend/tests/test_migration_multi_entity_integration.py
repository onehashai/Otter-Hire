"""Local PostgreSQL integration coverage for the multi-entity import commit."""

import base64
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.ats_migration import AtsIntegration, ImportAuditLog
from app.models.candidate import Candidate
from app.models.candidate_jobs import CandidateJobs
from app.models.document import CandidateDocument
from app.models.interview import Interview
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.note import Note
from app.models.organization import Organization
from app.models.stage import Stage
from app.models.user import User
from app.services.migration.batch_service import create_pending_batch, preview_batch
from app.temporal.migration.activities import commit_batch_activity
from app.temporal.migration.types import CommitBatchInput


class LocalStorageStub:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def write_bytes(self, object_key: str, content: bytes, content_type: str) -> str:
        self.objects[object_key] = content
        return object_key

    async def resolve_url(self, object_key: str) -> str:
        return f"/local/{object_key}"


@pytest.mark.anyio
async def test_multi_entity_commit_transfers_and_links_every_entity(db: AsyncSession, engine, monkeypatch):
    org = Organization(name="Local Migration Test")
    db.add(org)
    await db.flush()
    actor = User(
        org_id=org.id,
        email=f"migration-{uuid4()}@example.test",
        name="Local Admin",
        status="active",
        is_verified=True,
        role="admin",
    )
    db.add(actor)
    integration = AtsIntegration(
        org_id=org.id,
        provider="generic",
        auth_type="api_key",
        base_url="http://127.0.0.1:8992",
        field_mapping_config={},
    )
    db.add(integration)
    await db.flush()

    resume_content = b"%PDF-local-integration-test"
    bundle = {
        "job": [{"external_job_id": "job-1", "title": "Backend Engineer"}],
        "stage": [{
            "external_stage_id": "stage-1", "external_job_id": "job-1",
            "name": "Screen", "position": 1,
        }],
        "candidate": [{
            "external_candidate_id": "candidate-1", "first_name": "Ada",
            "last_name": "Lovelace", "email": "ada@example.com", "skills": ["Python"],
        }],
        "application": [{
            "external_application_id": "application-1", "external_candidate_id": "candidate-1",
            "external_job_id": "job-1", "external_stage_id": "stage-1", "status": "submitted",
        }],
        "resume": [{
            "external_document_id": "document-1", "external_candidate_id": "candidate-1",
            "content_base64": base64.b64encode(resume_content).decode(),
            "filename": "ada.pdf", "mime_type": "application/pdf",
        }],
        "interview": [{
            "external_interview_id": "interview-1", "external_candidate_id": "candidate-1",
            "external_job_id": "job-1", "scheduled_at": "2026-09-10T10:00:00+00:00",
            "interviewer_name": "External Interviewer",
        }],
        "note": [{
            "external_note_id": "note-1", "external_candidate_id": "candidate-1",
            "content": "Imported from local ATS", "author_name": "External Author",
        }],
    }
    batch = await create_pending_batch(db, integration, bundle, "integration-test")
    await db.refresh(batch, ["rows"])
    preview = await preview_batch(db, batch)
    assert (preview["created"], preview["updated"], preview["skipped"]) == (7, 0, 0)

    local_storage = LocalStorageStub()
    monkeypatch.setattr("app.temporal.migration.activities.storage_service", local_storage)
    monkeypatch.setattr(
        "app.temporal.migration.activities.AsyncSessionLocal",
        async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False),
    )

    result = await commit_batch_activity(
        CommitBatchInput(batch_id=str(batch.id), actor_id=str(actor.id))
    )
    assert result["status"] == "completed"
    assert result["committed"] == 6
    assert result["resumes_transferred"] == 1
    assert result["unresolved_errors"] == 0

    job = (await db.execute(select(Job).where(Job.external_job_id == "job-1"))).scalar_one()
    stage = (await db.execute(select(Stage).where(Stage.external_stage_id == "stage-1"))).scalar_one()
    candidate = (await db.execute(
        select(Candidate).where(Candidate.external_candidate_id == "candidate-1")
    )).scalar_one()
    application = (await db.execute(
        select(JobApplication).where(JobApplication.external_application_id == "application-1")
    )).scalar_one()
    assignment = (await db.execute(select(CandidateJobs).where(
        CandidateJobs.candidate_id == candidate.id, CandidateJobs.job_id == job.id
    ))).scalar_one()
    interview = (await db.execute(
        select(Interview).where(Interview.external_interview_id == "interview-1")
    )).scalar_one()
    note = (await db.execute(select(Note).where(Note.external_note_id == "note-1"))).scalar_one()
    document = (await db.execute(select(CandidateDocument).where(
        CandidateDocument.external_document_id == "document-1"
    ))).scalar_one()
    audit = (await db.execute(select(ImportAuditLog).where(
        ImportAuditLog.batch_id == batch.id, ImportAuditLog.action == "approved"
    ))).scalar_one()

    assert stage.job_id == job.id
    assert application.candidate_id == candidate.id
    assert application.job_id == job.id
    assert application.stage_id == stage.id
    assert assignment.stage_id == stage.id
    assert interview.candidate_id == candidate.id
    assert interview.job_id == job.id
    assert interview.source_interviewer_name == "External Interviewer"
    assert note.candidate_id == candidate.id
    assert note.source_author_name == "External Author"
    assert document.candidate_id == candidate.id
    assert document.mime_type == "application/pdf"
    assert local_storage.objects[document.object_key] == resume_content
    assert audit.metadata_json["committed_clean"] == 6
