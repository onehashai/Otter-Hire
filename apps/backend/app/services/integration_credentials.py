"""
Read/write integration credentials (all orgs) from integration_credentials table.

Use this module when an integration needs to store or retrieve encrypted secrets
(e.g. OAuth tokens). Config, status, and optional credentials live in integration_credentials.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.integration_credential import IntegrationCredential


async def get_credential(
    db: AsyncSession, org_id: UUID, integration_type: str
) -> IntegrationCredential | None:
    """Return the credential row for (org_id, integration_type), or None."""
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_type == integration_type,
        )
    )
    return result.scalar_one_or_none()


async def set_credential(
    db: AsyncSession,
    org_id: UUID,
    integration_type: str,
    encrypted_credentials: str,
) -> IntegrationCredential:
    """Upsert encrypted credentials for (org_id, integration_type). Returns the row."""
    row = await get_credential(db, org_id, integration_type)
    if row is None:
        row = IntegrationCredential(
            org_id=org_id,
            integration_type=integration_type,
            encrypted_credentials=encrypted_credentials,
        )
        db.add(row)
    else:
        row.encrypted_credentials = encrypted_credentials
    await db.commit()
    await db.refresh(row)
    return row


async def delete_credential(
    db: AsyncSession, org_id: UUID, integration_type: str
) -> bool:
    """Remove credentials for (org_id, integration_type). Returns True if a row was deleted."""
    row = await get_credential(db, org_id, integration_type)
    if row is None:
        return False
    await db.delete(row)
    await db.commit()
    return True
