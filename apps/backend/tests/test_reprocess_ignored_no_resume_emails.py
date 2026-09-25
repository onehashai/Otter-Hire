from app.models.email import InboundEmail
from app.schemas.public_jobs import InboundEmailPayload
from scripts.reprocess_ignored_no_resume_emails import _is_recoverable_application


def test_recovery_requires_application_signal_or_job_association() -> None:
    row = InboundEmail(job_id=None)
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="candidate@example.com",
        subject="Hello",
        text_body="Just checking in.",
    )

    assert not _is_recoverable_application(row, payload, False, True)


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


def test_automated_or_job_board_sender_cannot_be_marked_recoverable() -> None:
    row = InboundEmail(job_id="00000000-0000-0000-0000-000000000001")
    payload = InboundEmailPayload(
        inbox_address="careers@example.com",
        from_email="notifications@naukri.com",
        subject="Application update",
    )

    assert not _is_recoverable_application(row, payload, False, False)
