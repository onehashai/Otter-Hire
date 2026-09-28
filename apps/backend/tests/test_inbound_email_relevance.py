from datetime import datetime, timezone
from email.message import EmailMessage
from uuid import UUID

import pytest

from app.api.v1.internal.endpoints.public import (
    _has_candidate_application_signal,
    _is_automated_email,
    _is_resume_attachment,
    _missing_resume_reason,
    _normalize_resume_attachment_metadata,
    _should_capture_verification_email,
    _should_create_contact_only_candidate,
    _subject_job_title_variants,
)
from app.models.email import InboundEmail
from app.schemas.public_jobs import InboundEmailPayload
from app.temporal.inbound_email.activities import (
    _contact_from_email_body,
    _has_stored_attachment_fallback,
    _has_stored_resume_fallback,
    _is_placeholder_candidate_name,
    _is_resume_attachment_compatible,
    _resume_keyword_points,
    _should_preserve_low_confidence_resume,
)


def _payload(subject: str, text_body: str = "") -> InboundEmailPayload:
    return InboundEmailPayload(
        inbox_address="applications@example.com",
        from_email="candidate@example.com",
        subject=subject,
        text_body=text_body,
    )


def test_resume_attachment_is_an_application_signal_without_keywords() -> None:
    assert _has_candidate_application_signal(_payload("Vibe Coder"), has_resume=True)


def test_bare_subject_without_resume_still_requires_application_context() -> None:
    assert not _has_candidate_application_signal(_payload("Vibe Coder"), has_resume=False)


def test_application_language_remains_a_valid_signal_without_resume() -> None:
    assert _has_candidate_application_signal(
        _payload("Application for Product Engineer"), has_resume=False
    )


def test_job_board_notifications_have_a_specific_missing_resume_reason() -> None:
    expected = "Automated job-board notification - not a candidate application"

    assert _missing_resume_reason("employer@mail.internshala.com") == expected
    assert _missing_resume_reason("info@naukri.com") == expected


def test_candidate_without_resume_keeps_the_actionable_reason() -> None:
    assert _missing_resume_reason("candidate@example.com") == (
        "No resume attachment or link found - candidate creation requires resume"
    )


def test_clear_application_without_resume_can_create_contact_only_candidate() -> None:
    assert _should_create_contact_only_candidate(
        _payload(
            "Application for Vibe Coder - Roopak A",
            "I am writing to apply for the Vibe Coder role. My resume is attached.",
        ),
        has_resume=False,
        has_application_document=False,
    )


def test_human_email_without_resume_is_not_lost_to_keyword_filter() -> None:
    assert _should_create_contact_only_candidate(
        _payload("Hello", "Just wanted to say hi."),
        has_resume=False,
        has_application_document=False,
    )


def test_out_of_office_without_automation_header_is_ignored() -> None:
    payload = _payload("Out of office: Re: Application", "I am away this week.")
    assert _is_automated_email(payload)
    assert not _should_create_contact_only_candidate(
        payload, has_resume=False, has_application_document=False
    )


def test_auto_response_suppression_does_not_make_human_mail_automated() -> None:
    payload = _payload("Application", "I would like to apply.")
    payload.x_auto_response_suppress = "All"
    assert _is_automated_email(payload) is None


def test_sender_and_body_contact_fallback_extracts_signature_phone_location() -> None:
    row = InboundEmail(from_email="roopak023@gmail.com", from_name=None)
    name, email, phone, location = _contact_from_email_body(
        row,
        "I am applying for the role.\nLocation: Raleigh, NC\nRegards,\nRoopakraj A\n(555) 512-8834",
        None,
    )
    assert name == "Roopakraj A"
    assert email == "roopak023@gmail.com"
    assert phone == "+1 555-512-8834"
    assert location == "Raleigh, NC"


def test_job_board_notification_without_resume_does_not_create_candidate() -> None:
    assert not _should_create_contact_only_candidate(
        InboundEmailPayload(
            inbox_address="applications@example.com",
            from_email="notifications@naukri.com",
            subject="Application update",
            text_body="Your application has been received.",
        ),
        has_resume=False,
        has_application_document=False,
    )


def test_stored_resume_can_recover_missing_raw_email() -> None:
    inbound_email = InboundEmail(
        inbox_address="applications@example.com",
        org_id="00000000-0000-0000-0000-000000000001",
        has_resume_attachment=True,
        attachment_primary_storage_key="orgs/example/inbox/attachments/resume.pdf",
    )

    assert _has_stored_resume_fallback(inbound_email)


def test_stored_application_attachment_can_recover_missing_raw_email() -> None:
    inbound_email = InboundEmail(
        inbox_address="applications@example.com",
        org_id="00000000-0000-0000-0000-000000000001",
        has_resume_attachment=False,
        attachment_primary_storage_key="orgs/example/inbox/attachments/application.txt",
    )

    assert _has_stored_attachment_fallback(inbound_email)
    assert not _has_stored_resume_fallback(inbound_email)


def test_generic_mime_pdf_attachment_is_recognized_from_its_content() -> None:
    content = b"%PDF-1.7\nresume"

    assert _is_resume_attachment("attachment.bin", "application/octet-stream", content)
    assert _normalize_resume_attachment_metadata(
        "attachment.bin", "application/octet-stream", content
    ) == ("attachment.pdf", "application/pdf")


def test_generic_mime_docx_attachment_is_recognized_from_its_content() -> None:
    content = b"PK\x03\x04docx"

    assert _is_resume_attachment("attachment.bin", "application/octet-stream", content)
    assert _normalize_resume_attachment_metadata(
        "attachment.bin", "application/octet-stream", content
    ) == (
        "attachment.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


def test_non_resume_content_cannot_be_trusted_by_pdf_filename() -> None:
    assert not _is_resume_attachment("resume.pdf", "text/css", b"body { color: red; }")


def test_active_inbox_never_captures_an_application_as_setup_verification() -> None:
    assert not _should_capture_verification_email(
        "active",
        "noreply@gmail.com",
        "Verify forwarding",
        "Verification code: 123456",
        expected_provider="google",
        expected_mode="code",
    )


def test_resume_application_never_becomes_setup_verification_while_inbox_pending() -> None:
    assert not _should_capture_verification_email(
        "pending",
        "candidate@example.com",
        "Application for Vibe Coder",
        "Please find my resume attached. Pin code: 452001",
        expected_provider="zoho",
        expected_mode="code",
        has_resume=True,
        is_candidate_application=True,
    )


def test_clear_application_email_never_becomes_setup_verification_without_attachment() -> None:
    assert not _should_capture_verification_email(
        "pending",
        "candidate@example.com",
        "Application for Vibe Coder",
        "Dear Hiring Team, I am applying for this role. Please find my resume attached.",
        expected_provider="zoho",
        expected_mode="code",
        has_resume=False,
        is_candidate_application=True,
    )


def test_exact_job_title_subject_is_a_contact_only_application_signal() -> None:
    assert _subject_job_title_variants("Vibe Coder") == {"vibe coder"}


def test_job_application_subject_extracts_strict_title_variant() -> None:
    assert "vibe coder" in _subject_job_title_variants("Application for Vibe Coder role")


def test_low_confidence_valid_pdf_application_is_preserved_for_ai_parsing() -> None:
    assert _should_preserve_low_confidence_resume(
        content=b"%PDF-1.7\nminimal extracted text",
        is_candidate_application=True,
        resume_text="minimal extracted text",
    )


def test_resume_keyword_evidence_can_preserve_valid_docx() -> None:
    resume_text = "Summary\nExperience\nSkills\n"

    assert _resume_keyword_points(resume_text) == 3
    assert _should_preserve_low_confidence_resume(
        content=b"PK\x03\x04docx",
        is_candidate_application=False,
        resume_text=resume_text,
    )


def test_low_confidence_unsupported_attachment_is_not_preserved() -> None:
    assert not _should_preserve_low_confidence_resume(
        content=b"plain text attachment",
        is_candidate_application=True,
        resume_text="Experience Skills Summary",
    )


def test_placeholder_candidate_names_are_replaced_by_resume_data() -> None:
    assert _is_placeholder_candidate_name("Unknown Candidate")
    assert _is_placeholder_candidate_name(" applicant ")
    assert not _is_placeholder_candidate_name("Akshay Thakur")


def test_older_attachment_detector_uses_a_valid_file_signature() -> None:
    def older_detector(filename: str | None, content_type: str | None) -> bool:
        return filename == "resume.pdf" and content_type == "application/pdf"

    assert _is_resume_attachment_compatible(
        older_detector,
        "attachment.bin",
        "application/octet-stream",
        b"%PDF-1.7\nresume",
    )


def test_inbound_email_status_supports_processing_lifecycle() -> None:
    assert "processing" in InboundEmail.__table__.c.parse_status.type.enums


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "unreadable_resume,missing_raw,historical",
    [(False, False, False), (True, False, False), (False, True, False), (False, False, True)],
)
async def test_application_fallback_creates_active_candidate_and_processed_log(monkeypatch, unreadable_resume, missing_raw, historical) -> None:
    from app.api.v1.internal.endpoints import public
    from app.models.candidate import Candidate
    from app.services import automation, blocked_domains
    from app.services.resume import pipeline
    from app.services.storage import storage_service
    from app.temporal.candidate_enrichment import queue as enrichment_queue
    from app.temporal.inbound_email import activities
    from app.temporal.inbound_email.types import InboundEmailParseInput

    org_id = UUID("00000000-0000-0000-0000-000000000001")
    job_id = UUID("00000000-0000-0000-0000-000000000002")
    row = InboundEmail(
        id=UUID("00000000-0000-0000-0000-000000000003"),
        org_id=org_id,
        job_id=job_id,
        inbox_address="applications@example.com",
        from_email="sofia@example.com",
        from_name="Sofia Reyes" if missing_raw else None,
        subject="Application for Engineer",
        received_at=datetime.now(timezone.utc),
        raw_storage_key=None if missing_raw else "retained/body-only.eml",
        parse_status="processing",
        has_resume_attachment=unreadable_resume,
    )
    added = []
    assignments = []
    automation_calls = []
    message = EmailMessage()
    message["From"] = "sofia@example.com"
    message["To"] = "applications@example.com"
    message["Subject"] = "Application for Engineer"
    message.set_content(
        "I would like to apply.\nLocation: Raleigh, NC\nRegards,\nSofia Reyes\n(555) 512-8834\n"
    )
    if unreadable_resume:
        message.add_attachment(
            b"%PDF-1.7\nunreadable document", maintype="application", subtype="pdf", filename="resume.pdf"
        )
    raw = message.as_bytes()

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def execute(self, statement):
            entity = statement.column_descriptions[0].get("entity")
            value = row if entity is InboundEmail else None

            class Result:
                def scalar_one_or_none(self):
                    return value

                def scalars(self):
                    return self

                def first(self):
                    return value

            return Result()

        def add(self, record):
            if isinstance(record, Candidate):
                record.id = UUID("00000000-0000-0000-0000-000000000004")
            added.append(record)

        async def flush(self):
            pass

        async def commit(self):
            pass

    async def read_bytes(key):
        return raw

    async def resolve_url(key):
        return "https://storage.example.test/resume.pdf"

    def unreadable(*args, **kwargs):
        raise ValueError("unreadable resume")

    async def noop(*args, **kwargs):
        return None

    async def assign(*args, **kwargs):
        assignments.append(kwargs)

    async def automate(*args, **kwargs):
        automation_calls.append(kwargs)

    monkeypatch.setattr(activities, "AsyncSessionLocal", Session)
    monkeypatch.setattr(activities.settings, "s3_enabled_override", False)
    monkeypatch.setattr(storage_service, "read_bytes", read_bytes)
    monkeypatch.setattr(storage_service, "resolve_url", resolve_url)
    monkeypatch.setattr(public, "_parse_resume_bytes", unreadable)
    monkeypatch.setattr(pipeline, "run_resume_pipeline", lambda *args, **kwargs: None)
    monkeypatch.setattr(blocked_domains, "get_blocked_sender_reason", noop)
    monkeypatch.setattr(public, "_upsert_candidate_job_assignment", assign)
    monkeypatch.setattr(public, "_route_inbound_to_conversation", noop)
    monkeypatch.setattr(automation, "execute_automations_for_trigger", automate)
    monkeypatch.setattr(enrichment_queue, "enqueue_candidate_enrichment", noop)

    result = await activities.parse_inbound_email_activity(
        InboundEmailParseInput(
            inbound_email_id=str(row.id), org_id=str(org_id), force_contact_only=historical
        )
    )
    candidate = next(record for record in added if isinstance(record, Candidate))
    assert candidate.status == "active"
    assert candidate.job_id == job_id
    assert candidate.name == "Sofia Reyes"
    assert candidate.phone == (None if missing_raw else "+1 555-512-8834")
    assert "resume_pending" in candidate.tags
    assert assignments[0]["job_id"] == job_id
    assert row.parse_status == "processed"
    assert row.parsed_candidate_id == candidate.id
    assert result["status"] == "ok"
    assert len(automation_calls) == (0 if historical else 1)
