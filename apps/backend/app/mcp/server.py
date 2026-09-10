"""Standalone MCP server for localhost ATS import data and actions."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from mcp.server.fastmcp import FastMCP
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.ats_migration import AtsIntegration, ImportAuditLog, ImportBatch
from app.models.candidate import Candidate
from app.models.mcp_api_key import McpApiKey
from app.schemas.canonical import CanonicalCandidate
from app.services.import_export_service import upsert_canonical_candidate
from app.services.migration.batch_service import commit_batch
from app.temporal.client import get_temporal_client
from app.temporal.migration.types import AtsSyncInput
from app.temporal.migration.workflows import AtsSyncWorkflow

PREVIEW = "Call with confirm: false or omit it first to preview. This tool only commits data when called with confirm: true."


async def _authenticate(api_key: str, write: bool = False) -> McpApiKey:
    if not api_key or not api_key.startswith("mcp_live_"):
        raise ValueError("Valid MCP API key required")
    async with AsyncSessionLocal() as db:
        key = (
            await db.execute(
                select(McpApiKey).where(
                    McpApiKey.key_hash == hashlib.sha256(api_key.encode()).hexdigest(),
                    McpApiKey.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if key is None:
            raise ValueError("Invalid or revoked MCP API key")
        if write and key.scope != "read_write":
            raise PermissionError("This MCP key is read_only; a read_write key is required")
        return key


async def _audit(db, key: McpApiKey, action: str, metadata: dict[str, Any]) -> None:
    db.add(
        ImportAuditLog(
            batch_id=None,
            actor_id=key.created_by,
            action=f"mcp_{action}",
            metadata_json={**metadata, "mcp_key_id": str(key.id), "mcp_key_scope": key.scope},
        )
    )


async def _batch(db, key: McpApiKey, batch_id: UUID) -> ImportBatch:
    batch = (
        await db.execute(
            select(ImportBatch)
            .join(AtsIntegration)
            .options(
                selectinload(ImportBatch.integration),
                selectinload(ImportBatch.rows),
            )
            .where(ImportBatch.id == batch_id, AtsIntegration.org_id == key.org_id)
        )
    ).scalar_one_or_none()
    if batch is None:
        raise ValueError("Batch not found")
    return batch


def _batch_preview(batch: ImportBatch) -> dict[str, Any]:
    return {
        "would_commit": batch.valid_rows,
        "would_flag_as_duplicate": [
            {"row": row.row_number, "original_candidate_id": str(row.matched_candidate_id)}
            for row in batch.rows
            if row.row_status == "duplicate" and row.matched_candidate_id
        ],
        "would_leave_as_error": [
            {"row": row.row_number, "error_reason": row.error_reason}
            for row in batch.rows
            if row.row_status == "error"
        ],
        "batch_status": batch.status,
    }


def create_mcp_server() -> FastMCP:
    if not settings.mcp_server_enabled:
        raise RuntimeError("MCP_SERVER_ENABLED is false; MCP server will not start")
    mcp = FastMCP(
        "Otter Hire ATS",
        host=settings.mcp_server_host,
        port=settings.mcp_server_port,
        sse_path="/sse",
    )

    @mcp.tool(
        description="Search candidates by name, status, potential duplicate flag, or source ATS. Requires an MCP API key."
    )
    async def search_candidates(
        api_key: str,
        name: str | None = None,
        status: str | None = None,
        potential_duplicate: bool | None = None,
        source_ats: str | None = None,
    ) -> list[dict[str, Any]]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            query = select(Candidate).where(Candidate.org_id == key.org_id)
            if name:
                query = query.where(Candidate.name.ilike(f"%{name}%"))
            if status:
                query = query.where(Candidate.status == status)
            if potential_duplicate is not None:
                query = query.where(Candidate.is_pending_duplicate_review == potential_duplicate)
            if source_ats:
                query = query.where(Candidate.source.ilike(f"%{source_ats}%"))
            candidates = (
                (await db.execute(query.order_by(Candidate.created_at.desc()).limit(100)))
                .scalars()
                .all()
            )
            return [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "email": c.email,
                    "phone": c.phone,
                    "status": c.status,
                    "source": c.source,
                    "potential_duplicate": c.is_pending_duplicate_review,
                    "possible_duplicate_of_id": str(c.possible_duplicate_of_id)
                    if c.possible_duplicate_of_id
                    else None,
                }
                for c in candidates
            ]

    @mcp.tool(
        description="Get a candidate and duplicate-match information. Requires an MCP API key."
    )
    async def get_candidate(api_key: str, candidate_id: str) -> dict[str, Any]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            candidate = (
                await db.execute(
                    select(Candidate).where(
                        Candidate.id == UUID(candidate_id), Candidate.org_id == key.org_id
                    )
                )
            ).scalar_one_or_none()
            if candidate is None:
                raise ValueError("Candidate not found")
            original = (
                (
                    await db.execute(
                        select(Candidate).where(Candidate.id == candidate.possible_duplicate_of_id)
                    )
                ).scalar_one_or_none()
                if candidate.possible_duplicate_of_id
                else None
            )
            return {
                "id": str(candidate.id),
                "name": candidate.name,
                "email": candidate.email,
                "phone": candidate.phone,
                "status": candidate.status,
                "source": candidate.source,
                "tags": candidate.tags,
                "parsed_resume": candidate.parsed_resume,
                "potential_duplicate": candidate.is_pending_duplicate_review,
                "duplicate_original": {
                    "id": str(original.id),
                    "name": original.name,
                    "email": original.email,
                }
                if original
                else None,
            }

    @mcp.tool(description="Get candidates grouped by stage for a job. Requires an MCP API key.")
    async def get_job_pipeline(api_key: str, job_id: str) -> dict[str, Any]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            candidates = (
                (
                    await db.execute(
                        select(Candidate)
                        .where(Candidate.org_id == key.org_id, Candidate.job_id == UUID(job_id))
                        .order_by(Candidate.created_at)
                    )
                )
                .scalars()
                .all()
            )
            pipeline: dict[str, list[dict[str, Any]]] = {}
            for candidate in candidates:
                pipeline.setdefault(
                    str(candidate.stage_id) if candidate.stage_id else "unassigned", []
                ).append(
                    {"id": str(candidate.id), "name": candidate.name, "status": candidate.status}
                )
            return {"job_id": job_id, "stages": pipeline}

    @mcp.tool(description="List import batches and their statuses. Requires an MCP API key.")
    async def import_batches(api_key: str) -> list[dict[str, Any]]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            batches = (
                (
                    await db.execute(
                        select(ImportBatch)
                        .join(AtsIntegration)
                        .where(AtsIntegration.org_id == key.org_id)
                        .order_by(ImportBatch.created_at.desc())
                        .limit(100)
                    )
                )
                .scalars()
                .all()
            )
            return [
                {
                    "id": str(b.id),
                    "source": b.source,
                    "status": b.status,
                    "total_rows": b.total_rows,
                    "valid_rows": b.valid_rows,
                    "flagged_rows": b.flagged_rows,
                    "error_rows": b.error_rows,
                    "created_at": b.created_at.isoformat(),
                }
                for b in batches
            ]

    @mcp.tool(
        description="Get an import batch with valid, duplicate, and error row counts. Requires an MCP API key."
    )
    async def get_batch(api_key: str, batch_id: str) -> dict[str, Any]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            batch = await _batch(db, key, UUID(batch_id))
            return {
                "id": str(batch.id),
                "source": batch.source,
                "status": batch.status,
                "total_rows": batch.total_rows,
                "valid_rows": batch.valid_rows,
                "flagged_rows": batch.flagged_rows,
                "error_rows": batch.error_rows,
            }

    @mcp.tool(
        description="Preview what approving a pending import batch would do. Read-only; never writes data."
    )
    async def preview_import_batch(api_key: str, batch_id: str) -> dict[str, Any]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            return _batch_preview(await _batch(db, key, UUID(batch_id)))

    @mcp.tool(
        description="List connected ATS integrations and sync status without credentials. Requires an MCP API key."
    )
    async def ats_integrations(api_key: str) -> list[dict[str, Any]]:
        key = await _authenticate(api_key)
        async with AsyncSessionLocal() as db:
            items = (
                (
                    await db.execute(
                        select(AtsIntegration)
                        .where(AtsIntegration.org_id == key.org_id)
                        .order_by(AtsIntegration.created_at.desc())
                    )
                )
                .scalars()
                .all()
            )
            return [
                {
                    "id": str(i.id),
                    "provider": i.provider,
                    "status": i.status,
                    "last_synced_at": i.last_synced_at.isoformat() if i.last_synced_at else None,
                }
                for i in items
            ]

    @mcp.tool(description=f"Approve an import batch. {PREVIEW}")
    async def approve_import_batch(
        api_key: str, batch_id: str, confirm: bool = False
    ) -> dict[str, Any]:
        key = await _authenticate(api_key, write=True)
        async with AsyncSessionLocal() as db:
            batch = await _batch(db, key, UUID(batch_id))
            if not confirm:
                return _batch_preview(batch)
            if batch.status != "pending_approval":
                raise ValueError(f"Batch is already handled: {batch.status}")
            result = await commit_batch(
                db, batch, key.created_by,
                {"mcp_key_id": str(key.id), "mcp_key_scope": key.scope},
            )
            return {"batch_id": batch_id, "status": batch.status, **result}

    @mcp.tool(description=f"Import one candidate. {PREVIEW}")
    async def import_candidate(
        api_key: str, candidate: dict[str, Any], confirm: bool = False
    ) -> dict[str, Any]:
        key = await _authenticate(api_key, write=True)
        payload = CanonicalCandidate.model_validate(candidate)
        async with AsyncSessionLocal() as db:
            filters = [Candidate.email == str(payload.email)] if payload.email else []
            if payload.phone:
                filters.append(Candidate.phone == payload.phone)
            original = (
                (
                    await db.execute(
                        select(Candidate)
                        .where(Candidate.org_id == key.org_id, or_(*filters))
                        .limit(1)
                    )
                ).scalar_one_or_none()
                if filters
                else None
            )
            preview = {
                "would_create": payload.model_dump(mode="json"),
                "potential_duplicate_match": {"id": str(original.id), "name": original.name}
                if original
                else None,
            }
            if not confirm:
                return preview
            saved = await upsert_canonical_candidate(db, key.org_id, payload, "mcp")
            await _audit(db, key, "import_candidate", {"candidate_id": str(saved.id)})
            await db.commit()
            return {"candidate_id": str(saved.id), "status": "committed"}

    @mcp.tool(description=f"Trigger an ATS sync. {PREVIEW}")
    async def trigger_sync(
        api_key: str, integration_id: str, confirm: bool = False
    ) -> dict[str, Any]:
        key = await _authenticate(api_key, write=True)
        async with AsyncSessionLocal() as db:
            integration = (
                await db.execute(
                    select(AtsIntegration).where(
                        AtsIntegration.id == UUID(integration_id),
                        AtsIntegration.org_id == key.org_id,
                    )
                )
            ).scalar_one_or_none()
            if integration is None:
                raise ValueError("ATS integration not found")
            preview = {
                "would_fetch_since": integration.last_synced_at.isoformat()
                if integration.last_synced_at
                else None,
                "integration": {
                    "id": integration_id,
                    "provider": integration.provider,
                    "status": integration.status,
                },
            }
            if not confirm:
                return preview
            if integration.status == "pending_provider_setup":
                raise ValueError("Provider setup is still pending")
            client = await get_temporal_client()
            workflow_id = (
                f"ats-sync-{integration.id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
            )
            await client.start_workflow(
                AtsSyncWorkflow.run,
                AtsSyncInput(
                    integration_id=integration_id,
                    since=integration.last_synced_at.isoformat()
                    if integration.last_synced_at
                    else None,
                ),
                id=workflow_id,
                task_queue="ats-migration",
            )
            await _audit(
                db,
                key,
                "trigger_sync",
                {"integration_id": integration_id, "workflow_id": workflow_id},
            )
            integration.status = "syncing"
            await db.commit()
            return {"workflow_id": workflow_id, "status": "queued"}

    @mcp.tool(description=f"Disconnect an ATS integration. {PREVIEW}")
    async def disconnect_ats(
        api_key: str, integration_id: str, confirm: bool = False
    ) -> dict[str, Any]:
        key = await _authenticate(api_key, write=True)
        async with AsyncSessionLocal() as db:
            integration = (
                await db.execute(
                    select(AtsIntegration).where(
                        AtsIntegration.id == UUID(integration_id),
                        AtsIntegration.org_id == key.org_id,
                    )
                )
            ).scalar_one_or_none()
            if integration is None:
                raise ValueError("ATS integration not found")
            pending = (
                (
                    await db.execute(
                        select(ImportBatch.id).where(
                            ImportBatch.integration_id == integration.id,
                            ImportBatch.status == "pending_approval",
                        )
                    )
                )
                .scalars()
                .all()
            )
            preview = {
                "would_disconnect": integration.provider,
                "warning": f"{len(pending)} pending unapproved batch(es) depend on it"
                if pending
                else None,
            }
            if not confirm:
                return preview
            integration.encrypted_api_key = None
            integration.oauth_access_token_encrypted = None
            integration.oauth_refresh_token_encrypted = None
            integration.status = "disconnected"
            await _audit(
                db,
                key,
                "disconnect_ats",
                {"integration_id": integration_id, "pending_batches": len(pending)},
            )
            await db.commit()
            return {"integration_id": integration_id, "status": "disconnected"}

    return mcp


def main() -> None:
    create_mcp_server().run(transport="sse")


if __name__ == "__main__":
    main()
