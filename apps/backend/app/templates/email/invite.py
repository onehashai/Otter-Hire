from app.templates import EmailContent
from app.templates.email.base_email_template import (
    STYLE_HEADING,
    STYLE_TEXT,
    STYLE_TEXT_SMALL,
    base_email_template,
    block_button,
    esc,
    hr,
)


def build_invite_email(
    invite_url: str,
    platform_name: str,
    org_name: str,
    inviter_name: str,
    expiry_days: int,
) -> EmailContent:
    day_word = "day" if expiry_days == 1 else "days"
    inner = f"""
                <h1 style="{STYLE_HEADING}">You&apos;re invited</h1>
                <p style="{STYLE_TEXT}">
                <strong>{esc(inviter_name)}</strong> has invited you to join <strong>{esc(org_name)}</strong>
                on {esc(platform_name)}.
                </p>
                <p style="{STYLE_TEXT}">Click the button below to set up your account.</p>
                {block_button(invite_url, "Accept invitation")}
                {hr()}
                <p style="{STYLE_TEXT_SMALL}">
                This link will expire in {expiry_days} {day_word}. If you weren&apos;t expecting this
                invitation, you can ignore this email.
                </p>
            """
    html_body = base_email_template(inner)
    return EmailContent(
        subject=f"You've been invited to join {org_name} on {platform_name}",
        html=html_body,
        text=f"""
                You're invited!

                {inviter_name} has invited you to join {org_name} on {platform_name}.

                Open this link to accept your invitation:
                {invite_url}

                This link will expire in {expiry_days} {day_word}.

                If you weren't expecting this invitation, please ignore this email.
            """,
    )
