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


def build_verification_email(
    platform_name: str, expiry_hours: int, verify_url: str
) -> EmailContent:
    hour_word = "hour" if expiry_hours == 1 else "hours"
    inner = f"""
                <h1 style="{STYLE_HEADING}">Welcome to {esc(platform_name)}</h1>
                <p style="{STYLE_TEXT}">Please verify your email address by clicking the button below.</p>
                {block_button(verify_url, "Verify email")}
                {copy_paste_link_block(verify_url)}
                {hr()}
                <p style="{STYLE_TEXT_SMALL}">
                This link will expire in {expiry_hours} {hour_word}. If you didn&apos;t create an account,
                you can ignore this email.
                </p>
            """
    html_body = base_email_template(inner)
    return EmailContent(
        subject=f"Verify your {platform_name} account",
        html=html_body,
        text=f"""
                Welcome to {platform_name}!

                Please verify your email address by clicking the link in this email.

                Or copy and paste this link:
                {verify_url}

                This link will expire in {expiry_hours} {hour_word}.

                If you didn't create an account, please ignore this email.
            """,
    )
