from uuid import UUID

import pytest

from app.models.email import InboundEmail
from app.schemas.public_jobs import InboundEmailPayload
from scripts import reprocess_ignored_no_resume_emails as recovery
from scripts.reprocess_ignored_no_resume_emails import _is_recoverable_application


def test_recovery_reasons_exclude_blocked_and_job_board_mail() -> None:
    assert recovery._is_recoverable_reason("No resumes successfully parsed")
    assert recovery._is_recoverable_reason(
        "Automated email skipped: X-Auto-Response-Suppress: All"
    )
    assert not recovery._is_recoverable_reason(
        "Sender domain naukri.com is in organization blocked list"
    )
    assert not recovery._is_recoverable_reason(
        "Automated job-board notification - not a candidate application"
    )


@pytest.mark.asyncio
async def test_retained_attachment_recovers_missing_raw_mime(monkeypatch) -> None:
    row = InboundEmail(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Application for Vibe Coder",
        raw_storage_key=None,
        attachment_primary_storage_key="retained/resume.pdf",
        attachment_primary_filename="resume.pdf",
        attachment_primary_content_type="application/pdf",
    )

    async def read_bytes(key):
        assert key == "retained/resume.pdf"
        return b"%PDF-1.7\nresume"

    monkeypatch.setattr(recovery.storage_service, "read_bytes", read_bytes)
    payload, has_resume, sender_is_candidate = await recovery._recovery_payload(row)
    assert payload.from_email == "candidate@example.com"
    assert has_resume and sender_is_candidate


@pytest.mark.asyncio
async def test_retained_sender_can_recover_when_document_sources_are_missing() -> None:
    row = InboundEmail(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        from_name="Candidate Person",
        subject="Hello",
        raw_storage_key=None,
        attachment_primary_storage_key=None,
    )
    payload, has_resume, sender_is_candidate = await recovery._recovery_payload(row)
    assert payload.from_name == "Candidate Person"
    assert not has_resume
    assert sender_is_candidate


def test_recovery_preserves_human_mail_without_keywords_or_job_association() -> None:
    row = InboundEmail(job_id=None)
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Hello",
        text_body="Just checking in.",
    )

    assert _is_recoverable_application(row, payload, False, True)


def test_application_without_resume_is_recoverable() -> None:
    row = InboundEmail(job_id=None)
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Application for Vibe Coder",
        text_body="I am applying for the role. Please find my resume.",
    )

    assert _is_recoverable_application(row, payload, False, True)


def test_known_job_association_allows_recovery_of_resume_attachment() -> None:
    row = InboundEmail(job_id="00000000-0000-0000-0000-000000000001")
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Vibe Coder",
    )

    assert _is_recoverable_application(row, payload, True, True)


def test_exact_job_match_recovers_short_subject_without_resume() -> None:
    row = InboundEmail(job_id=None)
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Vibe Coder",
    )
    assert _is_recoverable_application(
        row, payload, False, True, matched_job=True
    )


@pytest.mark.asyncio
async def test_recovery_marks_processing_and_queues_without_deleting(monkeypatch) -> None:
    row_id = UUID("00000000-0000-0000-0000-000000000001")
    org_id = UUID("00000000-0000-0000-0000-000000000002")
    row = InboundEmail(
        id=row_id,
        org_id=org_id,
        parse_status="ignored",
        parse_error="Email does not match job application keywords",
        parsed_candidate_id=None,
    )
    commits = []
    queued = []

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def execute(self, stmt):
            class Result:
                def scalar_one_or_none(self):
                    return row

            return Result()

        async def commit(self):
            commits.append(row.parse_status)

    async def enqueue(**kwargs):
        queued.append(kwargs)

    monkeypatch.setattr(recovery, "AsyncSessionLocal", Session)
    monkeypatch.setattr(recovery, "enqueue_inbound_email_parse", enqueue)

    assert await recovery._mark_processing_and_enqueue(row_id, org_id, None)
    assert commits == ["processing"]
    assert queued[0]["input_data"].force_contact_only
    assert queued[0]["force"] is True


@pytest.mark.asyncio
async def test_dry_run_inspects_raw_email_without_enqueuing(monkeypatch, capsys) -> None:
    from app.services import blocked_domains

    row = InboundEmail(
        id=UUID("00000000-0000-0000-0000-000000000003"),
        org_id=UUID("00000000-0000-0000-0000-000000000002"),
        job_id=UUID("00000000-0000-0000-0000-000000000004"),
        from_email="candidate@example.com",
        subject="Application for Vibe Coder",
        parse_status="ignored",
        parse_error="No resume attachment or link found - candidate creation requires resume",
        raw_storage_key="retained/email.eml",
    )

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def execute(self, stmt):
            class Result:
                def scalars(self):
                    return self

                def all(self):
                    return [row]

            return Result()

    async def read_raw(record):
        return b"raw MIME data"

    async def not_blocked(*args, **kwargs):
        return None

    async def must_not_enqueue(*args, **kwargs):
        raise AssertionError("dry run must not enqueue")

    monkeypatch.setattr(recovery, "AsyncSessionLocal", Session)
    monkeypatch.setattr(recovery, "_read_raw_email", read_raw)
    monkeypatch.setattr(
        recovery,
        "_payload_from_raw",
        lambda record, raw: (
            InboundEmailPayload(
                inbox_address="careers@example.com",
                from_email="candidate@example.com",
                subject="Application for Vibe Coder",
            ),
            False,
            True,
        ),
    )
    monkeypatch.setattr(blocked_domains, "get_blocked_sender_domain", not_blocked)
    monkeypatch.setattr(recovery, "_mark_processing_and_enqueue", must_not_enqueue)

    await recovery.reprocess(limit=1, apply=False)
    assert "scanned=1 eligible=1 queued=0" in capsys.readouterr().out


def test_automated_or_job_board_sender_cannot_be_marked_recoverable() -> None:
    row = InboundEmail(job_id="00000000-0000-0000-0000-000000000001")
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="notifications@naukri.com",
        subject="Application update",
    )

    assert not _is_recoverable_application(row, payload, False, False)
