import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.templates import EmailContent
from app.templates.email.invite import build_invite_email
from app.templates.email.verification import build_verification_email


async def send_email(
    to_email: str,
    content: EmailContent,
    *,
    fallback_url: str | None = None,
    org_id: UUID | None = None,
    db: AsyncSession | None = None,
) -> None:
    # Route through SES (org-level identity) when configured
    if org_id is not None and db is not None:
        from app.integrations.app_store.email_integration.outbound_service import (
            get_verified_outbound_for_org,
        )
        from app.services.ses_outbound import send_email_via_ses

        outbound_row = await get_verified_outbound_for_org(db, org_id)
        from_email: str
        from_name: str | None
        if outbound_row is not None:
            cfg = outbound_row.config or {}
            from_email = cfg.get("from_email", "")
            from_name = cfg.get("from_name")
        elif settings.ses_outbound_from_email and settings.aws_access_key_id and settings.aws_secret_access_key:
            from_email = (settings.ses_outbound_from_email or "").strip()
            from_name = (settings.ses_outbound_from_name or "").strip() or None
        else:
            from_email = ""
            from_name = None

        if from_email and "@" in from_email:
            send_email_via_ses(
                from_email=from_email,
                from_name=from_name,
                to_email=to_email,
                subject=content.subject,
                text_body=content.text,
                html_body=content.html,
            )
            logger.info("Email sent to %s via SES: %s", to_email, content.subject)
            return

    if settings.is_production:
        await _send_via_zeptomail(to_email, content.subject, content.html, content.text)
    else:
        await _send_via_mailtrap(
            to_email, content.subject, content.html, content.text, fallback_url=fallback_url
        )


async def send_verification_email(to_email: str, verify_url: str) -> None:
    content = build_verification_email(
        verify_url, expiry_hours=settings.verification_token_expire_hours
    )
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
    if not all(
        [
            settings.mailtrap_host,
            settings.mailtrap_port,
            settings.mailtrap_username,
            settings.mailtrap_password,
        ]
    ):
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


