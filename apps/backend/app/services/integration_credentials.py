"""
Read/write integration credentials (all orgs) from integration_credentials table.

Use this module when an integration needs to store or retrieve encrypted secrets
(e.g. OAuth tokens). Config, status, and optional credentials live in integration_credentials.

Credentials are Fernet-encrypted at rest using the ENCRYPTION_KEY env var.
Call decrypt_value(row.encrypted_credentials, settings.encryption_key) when you need
the plaintext token.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import encrypt_value
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential


async def get_credential(
    db: AsyncSession, org_id: UUID, integration_slug: str
) -> IntegrationCredential | None:
    """Return the credential row for (org_id, integration_slug), or None."""
    integration = await db.scalar(select(Integration).where(Integration.slug == integration_slug))
    if integration is None:
        return None
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_id == integration.id,
        )
    )
    return result.scalar_one_or_none()


async def set_credential(
    db: AsyncSession,
    org_id: UUID,
    integration_slug: str,
    plaintext_credentials: str,
) -> IntegrationCredential:
    """Upsert Fernet-encrypted credentials for (org_id, integration_slug). Returns the row.

    *plaintext_credentials* is the raw secret (e.g. OAuth token). It is encrypted with
    ENCRYPTION_KEY before being written to the DB. Pass the plaintext — do not pre-encrypt.
    """
    if not settings.encryption_key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not configured. Cannot store integration credentials."
        )

    encrypted = encrypt_value(plaintext_credentials, settings.encryption_key)

    integration = await db.scalar(select(Integration).where(Integration.slug == integration_slug))
    if integration is None:
        raise ValueError(f"Unknown integration slug: {integration_slug}")
    row = await get_credential(db, org_id, integration_slug)
    if row is None:
        row = IntegrationCredential(
            org_id=org_id,
            integration_id=integration.id,
            encrypted_credentials=encrypted,
        )
        db.add(row)
    else:
        row.encrypted_credentials = encrypted
    await db.commit()
    await db.refresh(row)
    return row


async def delete_credential(db: AsyncSession, org_id: UUID, integration_slug: str) -> bool:
    """Remove credentials for (org_id, integration_slug). Returns True if a row was deleted."""
    row = await get_credential(db, org_id, integration_slug)
    if row is None:
        return False
    await db.delete(row)
    await db.commit()
    return True
