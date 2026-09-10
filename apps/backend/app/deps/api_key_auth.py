from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.api_key import ApiKey


async def get_api_key_org_id(
    x_api_key: str | None = Header(default=None), db: AsyncSession = Depends(get_db)
):
    if not x_api_key or not x_api_key.startswith("sk_live_"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Valid X-API-Key required")
    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    key = (await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True)))).scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return key.org_id
