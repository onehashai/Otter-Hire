"""
app.services.email — outbound transactional email.

Public API (drop-in replacement for the old app/services/email.py):
    send_email(to_email, content, *, fallback_url, org_id, db)
    send_verification_email(to_email, verify_url)
    send_invite_email(to_email, invite_url, org_name, inviter_name)
    send_candidate_note_mention_email(*, to_email, ...)

Provider is selected once at runtime based on available credentials:
  - ZeptoMail if ZEPTOMAIL_API_KEY + ZEPTOMAIL_FROM_EMAIL are set (unchanged)
  - SES       if AWS credentials + transactional From (SES_TRANSACTIONAL_FROM_EMAIL or legacy SES_FROM_EMAIL;
                default effective From noreply@smartats.in). Conversational SES uses reply+...@SES_MAIL_DOMAIN.
"""

from app.services.email._dispatch import send_email
from app.services.email._public import (
    send_candidate_note_mention_email,
    send_invite_email,
    send_password_reset_email,
    send_verification_email,
)

__all__ = [
    "send_email",
    "send_verification_email",
    "send_invite_email",
    "send_password_reset_email",
    "send_candidate_note_mention_email",
]
