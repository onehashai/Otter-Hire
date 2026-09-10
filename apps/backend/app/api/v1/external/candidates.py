from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.deps.api_key_auth import get_api_key_org_id
from app.models.candidate import Candidate
from app.schemas.canonical import CanonicalCandidate
from app.services.import_export_service import import_candidates

router = APIRouter(prefix="/candidates")


def _enabled() -> None:
    if not settings.ats_auto_import_enabled:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Data migration is disabled")


@router.post("/bulk")
async def bulk_import(
    candidates: list[CanonicalCandidate], org_id: UUID = Depends(get_api_key_org_id), db: AsyncSession = Depends(get_db)
):
    _enabled()
    return (await import_candidates(db, org_id, candidates, "external-api")).model_dump()


@router.get("")
async def list_candidates(
    q: str | None = Query(default=None), skill: str | None = Query(default=None),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200),
    org_id: UUID = Depends(get_api_key_org_id), db: AsyncSession = Depends(get_db),
):
    _enabled()
    query = select(Candidate).where(Candidate.org_id == org_id)
    if q:
        query = query.where(or_(Candidate.name.ilike(f"%{q}%"), Candidate.email.ilike(f"%{q}%")))
    if skill:
        query = query.where(Candidate.tags.contains([skill]))
    items = (await db.execute(query.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {"page": page, "page_size": page_size, "items": [
        {"id": item.id, "name": item.name, "email": item.email, "phone": item.phone, "skills": item.tags or [], "status": item.status}
        for item in items
    ]}
