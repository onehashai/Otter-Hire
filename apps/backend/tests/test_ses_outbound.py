import asyncio

from app.core.config import settings
from app.services.email._providers.ses import SesProvider
from app.services.ses_outbound import _fit_references_header


def test_references_header_keeps_newest_ids_under_ses_limit():
    references = " ".join(f"<message-{index}@example.com>" for index in range(100))

    result = _fit_references_header(references)

    assert len(result) <= 980
    assert len("References") + 2 + len(result) <= 996
    assert "<message-99@example.com>" in result
    assert "<message-0@example.com>" not in result


def test_references_header_normalizes_ids():
    assert _fit_references_header("first@example.com <second@example.com>") == (
        "<first@example.com> <second@example.com>"
    )


def test_conversation_email_uses_transactional_from_and_exact_reply_to(monkeypatch):
    captured: dict = {}

    def fake_send_email_via_ses(**kwargs):
        captured.update(kwargs)
        return "ses-message-id"

    monkeypatch.setattr(
        "app.services.ses_outbound.send_email_via_ses",
        fake_send_email_via_ses,
    )
    monkeypatch.setattr(settings, "ses_transactional_from_email", "noreply@smartats.in")

    reply_to = "reply+01a0a9d2-cff2-7983-8f42-60aa7bbd02f9@applications.smartats.in"
    result = asyncio.run(
        SesProvider().send_conversation(
            from_email=reply_to,
            from_name="Recruiter from SmartATS",
            to_email="candidate@example.com",
            subject="Application update",
            text_body="Hello",
            html_body="<p>Hello</p>",
            in_reply_to=None,
            references=None,
            message_id_tag="message-id",
            org_id_tag="org-id",
        )
    )

    assert captured["from_email"] == "noreply@smartats.in"
    assert captured["reply_to"] == reply_to
    assert result.provider_message_id == "ses:ses-message-id"
