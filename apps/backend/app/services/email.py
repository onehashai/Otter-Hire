import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.email_templates import EmailContent
from app.email_templates.verification import build_verification_email
from app.email_templates.invite import build_invite_email


async def send_email(to_email: str, content: EmailContent, *, fallback_url: str | None = None) -> None:
    if settings.is_production:
        await _send_via_zeptomail(to_email, content.subject, content.html, content.text)
    else:
        await _send_via_mailtrap(to_email, content.subject, content.html, content.text, fallback_url=fallback_url)


async def send_verification_email(to_email: str, verify_url: str) -> None:
    content = build_verification_email(verify_url, expiry_hours=settings.verification_token_expire_hours)
    await send_email(to_email, content, fallback_url=verify_url)


async def send_invite_email(
    to_email: str,
    invite_url: str,
    org_name: str,
    inviter_name: str,
) -> None:
    content = build_invite_email(
        invite_url=invite_url,
        org_name=org_name,
        inviter_name=inviter_name,
        expiry_days=settings.invite_token_expire_days,
    )
    await send_email(to_email, content, fallback_url=invite_url)


async def _send_via_mailtrap(
    to_email: str, subject: str, html_body: str, text_body: str, *, fallback_url: str | None = None
) -> None:
    if not all([settings.mailtrap_host, settings.mailtrap_port, settings.mailtrap_username, settings.mailtrap_password]):
        logger.warning("Mailtrap config missing. Printing URL to console:")
        if fallback_url:
            logger.warning(f"Action URL: {fallback_url}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.mailtrap_from_email or "noreply@onehash.ai"
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.mailtrap_host, settings.mailtrap_port) as server:
            server.starttls()
            server.login(settings.mailtrap_username, settings.mailtrap_password)
            server.send_message(msg)

        logger.info(f"Email sent to {to_email} via Mailtrap: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email via Mailtrap: {e}")
        if fallback_url:
            logger.warning(f"Action URL: {fallback_url}")


async def _send_via_zeptomail(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.zeptomail_api_key or not settings.zeptomail_from_email:
        raise ValueError("ZeptoMail configuration missing in production")

    url = "https://api.zeptomail.com/v1.1/email"
    headers = {
        "Authorization": settings.zeptomail_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "from": {
            "address": settings.zeptomail_from_email,
            "name": settings.zeptomail_from_name or "OneHash ATS",
        },
        "to": [{"email_address": {"address": to_email}}],
        "subject": subject,
        "htmlbody": html_body,
        "textbody": text_body,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()

    logger.info(f"Email sent to {to_email} via ZeptoMail: {subject}")
