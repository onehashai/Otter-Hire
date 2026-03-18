from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_credential import IntegrationCredential
from app.schemas.integrations import IntegrationOwnerContext

INTEGRATION_TYPE = "outbound_email"


async def _get_row(db: AsyncSession, org_id: UUID) -> IntegrationCredential | None:
    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_type == INTEGRATION_TYPE,
        )
    )
    return result.scalar_one_or_none()


def _serialize(row: IntegrationCredential) -> dict:
    cfg = row.config or {}
    return {
        "id": str(row.id),
        "integration_type": row.integration_type,
        "sending_domain": cfg.get("sending_domain"),
        "from_email": cfg.get("from_email", ""),
        "from_name": cfg.get("from_name"),
        "status": row.status,
    }


async def get_outbound_config(db: AsyncSession, owner: IntegrationOwnerContext) -> dict | None:
    row = await _get_row(db, owner.org_id)
    return _serialize(row) if row else None


async def upsert_outbound_config(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    sending_domain: str,
    from_email: str,
    from_name: str | None,
) -> dict:
    """Save outbound config. Uses org-level SES; no DNS or per-domain verification."""
    sending_domain = sending_domain.strip().lower()
    from_email = from_email.strip().lower()
    if not sending_domain or "." not in sending_domain:
        raise HTTPException(
            status_code=422, detail="Valid sending domain is required (e.g. company.com)"
        )
    if not from_email or "@" not in from_email:
        raise HTTPException(status_code=422, detail="Valid from email is required")
    if not from_email.endswith(f"@{sending_domain}"):
        raise HTTPException(
            status_code=422,
            detail=f"From email must use the sending domain (e.g. careers@{sending_domain})",
        )

    plain_config = {
        "sending_domain": sending_domain,
        "from_email": from_email,
        "from_name": (from_name or "").strip() or None,
    }

    row = await _get_row(db, owner.org_id)
    if row is None:
        row = IntegrationCredential(
            org_id=owner.org_id,
            integration_type=INTEGRATION_TYPE,
            config=plain_config,
            status="active",
        )
        db.add(row)
    else:
        row.config = plain_config
        row.status = "active"
        row.last_test_error = None

    await db.commit()
    await db.refresh(row)
    return _serialize(row)


async def delete_outbound_config(db: AsyncSession, owner: IntegrationOwnerContext) -> None:
    row = await _get_row(db, owner.org_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Outbound email is not configured.")
    await db.delete(row)
    await db.commit()


async def get_verified_outbound_for_org(
    db: AsyncSession, org_id: UUID
) -> IntegrationCredential | None:
    """Returns the org's outbound integration when configured and active (uses org SES identity)."""
    row = await _get_row(db, org_id)
    if row is None or row.status != "active":
        return None
    cfg = row.config or {}
    if not cfg.get("sending_domain") or not cfg.get("from_email"):
        return None
    return row
