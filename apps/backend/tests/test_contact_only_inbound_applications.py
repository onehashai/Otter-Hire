from app.api.v1.internal.endpoints.public import (
    _contact_only_candidate_name,
    _is_job_board_notification_sender,
)
from app.integrations.app_store.email_integration.ses_bridge import (
    _is_reprocessable_no_resume_email,
)


def test_job_board_notification_senders_are_excluded() -> None:
    assert _is_job_board_notification_sender("notifications@naukri.com")
    assert _is_job_board_notification_sender("jobs@mail.internshala.com")
    assert not _is_job_board_notification_sender("applicant@gmail.com")


def test_contact_only_candidate_name_uses_sender_display_name() -> None:
    assert _contact_only_candidate_name("Roopak A", "roopak023@gmail.com") == "Roopak A"


def test_contact_only_candidate_name_falls_back_to_email_local_part() -> None:
    assert _contact_only_candidate_name(None, "roopak.raj023@gmail.com") == "Roopak Raj"


def test_only_eligible_no_resume_application_logs_are_replayed() -> None:
    reason = "No resume attachment or link found - candidate creation requires resume"

    assert _is_reprocessable_no_resume_email("ignored", reason, "applicant@gmail.com")
    assert not _is_reprocessable_no_resume_email(
        "ignored", "Email does not match job application keywords", "applicant@gmail.com"
    )
    assert not _is_reprocessable_no_resume_email("ignored", reason, "alerts@naukri.com")
    assert not _is_reprocessable_no_resume_email("processed", reason, "applicant@gmail.com")
