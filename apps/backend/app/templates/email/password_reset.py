from app.templates import EmailContent
from app.templates.email.base_email_template import (
    STYLE_HEADING,
    STYLE_TEXT,
    STYLE_TEXT_SMALL,
    base_email_template,
    block_button,
    copy_paste_link_block,
    esc,
    hr,
)


def build_password_reset_email(
    platform_name: str, expiry_hours: int, reset_url: str
) -> EmailContent:
    hour_word = "hour" if expiry_hours == 1 else "hours"
    inner = f"""
                <h1 style="{STYLE_HEADING}">Reset your {esc(platform_name)} password</h1>
                <p style="{STYLE_TEXT}">We received a request to reset your password. Click the button below to set a new one.</p>
                {block_button(reset_url, "Reset password")}
                {copy_paste_link_block(reset_url)}
                {hr()}
                <p style="{STYLE_TEXT_SMALL}">
                This link will expire in {expiry_hours} {hour_word}. If you didn&apos;t request a
                password reset, you can safely ignore this email &mdash; your password won&apos;t change.
                </p>
            """
    html_body = base_email_template(inner)
    return EmailContent(
        subject=f"Reset your {platform_name} password",
        html=html_body,
        text=f"""
                Reset your {platform_name} password.

                We received a request to reset your password. Click the link below or copy and paste it into your browser:

                {reset_url}

                This link will expire in {expiry_hours} {hour_word}.

                If you didn't request a password reset, you can safely ignore this email.
            """,
    )
