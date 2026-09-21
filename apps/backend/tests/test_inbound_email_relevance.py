from app.api.v1.internal.endpoints.public import _has_candidate_application_signal
from app.schemas.public_jobs import InboundEmailPayload


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
