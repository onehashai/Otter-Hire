from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from app.core.config import settings
from app.schemas.canonical import ImportRowError
from app.services.import_export_service import upsert_canonical_candidate
from app.services.migration.checkpoint import FileCheckpointStore
from app.services.migration.config_loader import ConnectorConfig
from app.services.migration.fetcher import GenericFetcher
from app.services.migration.normalizer import normalize_candidate

_jobs: dict[str, dict[str, Any]] = {}
_lock = asyncio.Lock()


def job_status(job_id: str) -> dict[str, Any] | None:
    return _jobs.get(job_id)


async def start_migration(
    db_factory: Any, org_id: UUID, config: ConnectorConfig, secret: str | None
) -> dict[str, Any]:
    job_id = str(uuid4())
    _jobs[job_id] = {
        "id": job_id, "connector_id": config.id, "status": "queued", "total_processed": 0,
        "successful": 0, "failed": 0, "errors": [], "started_at": datetime.now(timezone.utc).isoformat(),
    }
    asyncio.create_task(_run_migration(db_factory, org_id, config, secret, job_id))
    return _jobs[job_id]


async def _run_migration(db_factory: Any, org_id: UUID, config: ConnectorConfig, secret: str | None, job_id: str) -> None:
    checkpoint = FileCheckpointStore(Path(settings.local_storage_root) / "migration-checkpoints")
    state = await checkpoint.read(job_id)
    fetcher = GenericFetcher(config, secret)
    try:
        _jobs[job_id]["status"] = "fetching"
        async with db_factory() as db:  # type: AsyncSession
            _jobs[job_id]["status"] = "normalizing"
            async for raw in fetcher.records("candidates", state):
                _jobs[job_id]["total_processed"] += 1
                try:
                    candidate = normalize_candidate(raw, config.mappings.get("candidate", {}))
                    _jobs[job_id]["status"] = "loading"
                    await upsert_canonical_candidate(db, org_id, candidate, f"migration:{config.id}")
                    _jobs[job_id]["successful"] += 1
                except Exception as exc:
                    _jobs[job_id]["failed"] += 1
                    _jobs[job_id]["errors"].append(ImportRowError(row=_jobs[job_id]["total_processed"], message=str(exc)).model_dump())
                if _jobs[job_id]["total_processed"] % 25 == 0:
                    await db.commit()
                    await checkpoint.write(job_id, {"processed": _jobs[job_id]["total_processed"]})
            await db.commit()
        _jobs[job_id]["status"] = "completed"
    except Exception as exc:
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["errors"].append({"row": 0, "message": str(exc)})
