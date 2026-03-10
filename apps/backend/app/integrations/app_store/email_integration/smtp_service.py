import json
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.integration import OrgIntegration
from app.schemas.integrations import IntegrationOwnerContext

INTEGRATION_TYPE = "smtp"
PASSWORD_MASK = "••••••••"


# ---------------------------------------------------------------------------
# Encryption helpers
# ---------------------------------------------------------------------------

def _get_fernet() -> Fernet:
    key = settings.smtp_encryption_key
    if not key:
        raise HTTPException(
            status_code=503,
            detail="SMTP encryption not configured on this server. Set SMTP_ENCRYPTION_KEY.",
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def _encrypt(data: dict) -> str:
    return _get_fernet().encrypt(json.dumps(data).encode()).decode()


def _decrypt(token: str) -> dict:
    try:
        return json.loads(_get_fernet().decrypt(token.encode()).decode())
    except (InvalidToken, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail="Failed to decrypt integration credentials") from e


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _get_row(db: AsyncSession, org_id: UUID) -> OrgIntegration | None:
    result = await db.execute(
        select(OrgIntegration).where(
            OrgIntegration.org_id == org_id,
            OrgIntegration.integration_type == INTEGRATION_TYPE,
        )
    )
    return result.scalar_one_or_none()


def _serialize(row: OrgIntegration) -> dict:
    cfg = row.config or {}
    return {
        "id": str(row.id),
        "integration_type": row.integration_type,
        "host": cfg.get("host", ""),
        "port": cfg.get("port", 587),
        "username": cfg.get("username", ""),
        "password": PASSWORD_MASK,
        "from_email": cfg.get("from_email", ""),
        "from_name": cfg.get("from_name"),
        "use_tls": cfg.get("use_tls", True),
        "use_ssl": cfg.get("use_ssl", False),
        "status": row.status,
        "last_tested_at": row.last_tested_at.isoformat() if row.last_tested_at else None,
        "last_test_error": row.last_test_error,
    }


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def get_smtp_config(db: AsyncSession, owner: IntegrationOwnerContext) -> dict | None:
    row = await _get_row(db, owner.org_id)
    return _serialize(row) if row else None


async def upsert_smtp_config(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    host: str,
    port: int,
    username: str,
    password: str | None,
    from_email: str,
    from_name: str | None,
    use_tls: bool,
    use_ssl: bool,
) -> dict:
    row = await _get_row(db, owner.org_id)

    plain_config = {
        "host": host.strip(),
        "port": port,
        "username": username.strip(),
        "from_email": from_email.strip().lower(),
        "from_name": from_name,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
    }

    if row is None:
        if not password or password == PASSWORD_MASK:
            raise HTTPException(status_code=422, detail="Password is required for new SMTP config")
        encrypted = _encrypt({"password": password})
        row = OrgIntegration(
            org_id=owner.org_id,
            integration_type=INTEGRATION_TYPE,
            config=plain_config,
            encrypted_credentials=encrypted,
            status="pending",
        )
        db.add(row)
    else:
        row.config = plain_config
        if password and password != PASSWORD_MASK:
            row.encrypted_credentials = _encrypt({"password": password})
        row.status = "pending"
        row.last_test_error = None

    await db.commit()
    await db.refresh(row)
    return _serialize(row)


async def test_smtp_connection(db: AsyncSession, owner: IntegrationOwnerContext) -> dict:
    row = await _get_row(db, owner.org_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No SMTP config found. Save config first.")
    if not row.encrypted_credentials:
        raise HTTPException(status_code=422, detail="No credentials stored for SMTP config.")

    creds = _decrypt(row.encrypted_credentials)
    plain_password = creds.get("password", "")
    cfg = row.config or {}
    error: str | None = None

    try:
        if cfg.get("use_ssl"):
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10) as server:
                server.login(cfg["username"], plain_password)
                _send_test_email(server, cfg["from_email"], cfg.get("from_name"))
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
                if cfg.get("use_tls"):
                    server.starttls()
                server.login(cfg["username"], plain_password)
                _send_test_email(server, cfg["from_email"], cfg.get("from_name"))
        logger.info(f"SMTP test succeeded for org={owner.org_id} host={cfg.get('host')}")
    except smtplib.SMTPAuthenticationError as e:
        raw = e.smtp_error
        error = f"Authentication failed: {raw.decode(errors='replace') if isinstance(raw, bytes) else str(e)}"
    except smtplib.SMTPConnectError as e:
        error = f"Could not connect to {cfg.get('host')}:{cfg.get('port')} — {e}"
    except TimeoutError:
        error = f"Connection to {cfg.get('host')}:{cfg.get('port')} timed out"
    except Exception as e:
        error = str(e)

    row.last_tested_at = datetime.now(timezone.utc)
    row.last_test_error = error
    row.status = "active" if error is None else "failed"
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


def _send_test_email(server: smtplib.SMTP, from_email: str, from_name: str | None) -> None:
    display_name = from_name or from_email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "SMTP connection test — OneHash ATS"
    msg["From"] = f"{display_name} <{from_email}>"
    msg["To"] = from_email
    msg.attach(MIMEText("Your SMTP outbound configuration is working correctly.", "plain"))
    server.send_message(msg)


async def delete_smtp_config(db: AsyncSession, owner: IntegrationOwnerContext) -> None:
    row = await _get_row(db, owner.org_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No SMTP config found")
    await db.delete(row)
    await db.commit()


async def get_verified_smtp_for_org(db: AsyncSession, org_id: UUID) -> OrgIntegration | None:
    """Returns the org's SMTP integration row only when status is active. Used by email service."""
    row = await _get_row(db, org_id)
    return row if (row and row.status == "active") else None


def decrypt_password_for_sending(row: OrgIntegration) -> str:
    if not row.encrypted_credentials:
        raise ValueError("No credentials stored on SMTP integration row")
    return _decrypt(row.encrypted_credentials).get("password", "")
