import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.logging import logger


async def send_verification_email(to_email: str, verify_url: str) -> None:
    """Send verification email via Mailtrap (dev) or ZeptoMail (prod)."""
    subject = "Verify your OneHash ATS account"
    html_body = f"""
    <html>
        <body>
            <h2>Welcome to OneHash ATS!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verify_url}">Verify Email</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
        </body>
    </html>
    """
    text_body = f"""
    Welcome to OneHash ATS!
    
    Please verify your email address by visiting:
    {verify_url}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, please ignore this email.
    """

    if settings.is_production:
        await _send_via_zeptomail(to_email, subject, html_body, text_body)
    else:
        await _send_via_mailtrap(to_email, subject, html_body, text_body, verify_url)


async def _send_via_mailtrap(
    to_email: str, subject: str, html_body: str, text_body: str, verify_url: str
) -> None:
    """Send email via Mailtrap SMTP (dev only)."""
    if not all([settings.mailtrap_host, settings.mailtrap_port, settings.mailtrap_username, settings.mailtrap_password]):
        logger.warning("Mailtrap config missing. Printing verification URL to console:")
        logger.warning(f"Verification URL: {verify_url}")
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

        logger.info(f"Verification email sent to {to_email} via Mailtrap")
    except Exception as e:
        logger.error(f"Failed to send email via Mailtrap: {e}")
        logger.warning(f"Verification URL: {verify_url}")


async def _send_via_zeptomail(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Send email via ZeptoMail API (prod only)."""
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

    logger.info(f"Verification email sent to {to_email} via ZeptoMail")
