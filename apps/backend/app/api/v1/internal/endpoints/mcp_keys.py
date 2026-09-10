from __future__ import annotations

import hashlib
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.mcp_api_key import McpApiKey
from app.models.user import User
from app.schemas.migration import McpKeyCreate, McpKeyCreated, McpKeyRead

router = APIRouter(prefix="/mcp-keys", tags=["mcp-keys"])


def _enabled() -> None:
    if not settings.mcp_server_enabled:
        raise HTTPException(status_code=404, detail="MCP server is disabled")


@router.post("", response_model=McpKeyCreated, status_code=201)
async def create_mcp_key(
    body: McpKeyCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    raw = f"mcp_live_{secrets.token_urlsafe(32)}"
    db_key = McpApiKey(
        org_id=user.org_id, created_by=user.id, name=body.name,
        key_prefix=raw[:16], key_hash=hashlib.sha256(raw.encode()).hexdigest(), scope=body.scope,
    )
    db.add(db_key)
    await db.commit()
    await db.refresh(db_key)
    return McpKeyCreated(id=db_key.id, name=db_key.name, scope=db_key.scope, key=raw)


@router.get("", response_model=list[McpKeyRead])
async def list_mcp_keys(
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    return (await db.execute(select(McpApiKey).where(McpApiKey.org_id == user.org_id).order_by(McpApiKey.created_at.desc()))).scalars().all()


@router.post("/{key_id}/revoke", status_code=204)
async def revoke_mcp_key(
    key_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    key = (await db.execute(select(McpApiKey).where(McpApiKey.id == key_id, McpApiKey.org_id == user.org_id))).scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=404, detail="MCP key not found")
    key.is_active = False
    await db.commit()
