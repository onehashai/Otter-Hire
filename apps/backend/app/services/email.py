import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.email_templates import EmailContent
from app.email_templates.invite import build_invite_email
from app.email_templates.verification import build_verification_email

if TYPE_CHECKING:
    from app.models.integration import OrgIntegration


async def send_email(
    to_email: str,
    content: EmailContent,
    *,
    fallback_url: str | None = None,
    org_id: UUID | None = None,
    db: AsyncSession | None = None,
) -> None:
    # Route through the org's own SMTP if configured and verified
    if org_id is not None and db is not None:
        from app.integrations.app_store.email_integration.smtp_service import (
            get_verified_smtp_for_org,
        )

        smtp_cfg = await get_verified_smtp_for_org(db, org_id)
        if smtp_cfg is not None:
            await _send_via_org_smtp(
                to_email,
                content.subject,
                content.html,
                content.text,
                smtp_cfg,
            )
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
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    *,
    fallback_url: str | None = None,
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


async def _send_via_zeptomail(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
) -> None:
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


async def _send_via_org_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    smtp_row: "OrgIntegration",
) -> None:
    from app.integrations.app_store.email_integration.smtp_service import (
        decrypt_password_for_sending,
    )

    plain_password = decrypt_password_for_sending(smtp_row)
    cfg = smtp_row.config or {}
    display_name = cfg.get("from_name") or cfg.get("from_email", "")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{display_name} <{cfg.get('from_email', '')}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    host, port = cfg.get("host", ""), cfg.get("port", 587)
    try:
        if cfg.get("use_ssl"):
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(cfg.get("username", ""), plain_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if cfg.get("use_tls"):
                    server.starttls()
                server.login(cfg.get("username", ""), plain_password)
                server.send_message(msg)
        logger.info(f"Email sent to {to_email} via org SMTP ({host}): {subject}")
    except Exception as e:
        logger.error(f"Failed to send email via org SMTP: {e}")
        raise
