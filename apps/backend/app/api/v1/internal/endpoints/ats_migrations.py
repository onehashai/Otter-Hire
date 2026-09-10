from __future__ import annotations

import csv
import io
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.crypto import encrypt_value
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.ats_mcp_registry import AtsMcpRegistry
from app.models.ats_migration import AtsIntegration, GenericAtsConfig, ImportBatch
from app.models.user import User
from app.schemas.migration import (
    AtsIntegrationCreate,
    AtsIntegrationRead,
    AtsMcpConnectRequest,
    AtsMcpProviderRead,
    BatchCommitResponse,
    BatchPreviewResponse,
    BatchRetryRequest,
    GenericAtsConfigCreate,
    ImportBatchDetail,
    ImportBatchRead,
)
from app.services.migration.batch_service import create_pending_batch, preview_batch, reject_batch
from app.services.migration.config_loader import load_connector_registry
from app.temporal.client import get_temporal_client
from app.temporal.migration.types import AtsSyncInput, CommitBatchInput
from app.temporal.migration.workflows import AtsSyncWorkflow, CommitBatchWorkflow

router = APIRouter(prefix="/ats-migrations", tags=["ats-migrations"])
CONFIG_DIR = Path(__file__).resolve().parents[3] / "migration_configs"
NAMED_PROVIDERS = {"greenhouse", "lever", "smartrecruiters", "bamboohr", "workable", "otter_local"}
PENDING_PROVIDERS = {"workday", "icims"}


def _enabled() -> None:
    if not settings.ats_auto_import_enabled:
        raise HTTPException(status_code=404, detail="ATS auto-import is disabled")


def _batch_query(org_id: UUID):
    return (
        select(ImportBatch)
        .join(AtsIntegration)
        .options(selectinload(ImportBatch.integration), selectinload(ImportBatch.rows))
        .where(AtsIntegration.org_id == org_id)
    )


@router.post("/integrations", response_model=AtsIntegrationRead, status_code=status.HTTP_201_CREATED)
async def create_integration(
    body: AtsIntegrationCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    connector = load_connector_registry(CONFIG_DIR).get(body.provider)
    if body.provider not in NAMED_PROVIDERS | PENDING_PROVIDERS or (connector is None and body.provider not in PENDING_PROVIDERS):
        raise HTTPException(status_code=400, detail="Unknown or disabled connector")
    encrypted = None
    if body.api_key:
        if not settings.encryption_key:
            raise HTTPException(status_code=500, detail="Credential encryption is not configured")
        encrypted = encrypt_value(body.api_key, settings.encryption_key)
    integration = (await db.execute(
        select(AtsIntegration).where(
            AtsIntegration.org_id == user.org_id,
            AtsIntegration.provider == body.provider,
        )
    )).scalar_one_or_none()
    mapping = (
        body.field_mapping_config.model_dump()
        if body.field_mapping_config.candidate
        else {"candidate": connector.mappings.get("candidate", {})}
    )
    integration_status = "pending_provider_setup" if body.provider in PENDING_PROVIDERS else "connected"
    if integration is None:
        integration = AtsIntegration(
            org_id=user.org_id,
            provider=body.provider,
            base_url=body.base_url,
            encrypted_api_key=encrypted,
            credential_last4=body.api_key[-4:] if body.api_key else None,
            field_mapping_config=mapping,
            auth_type=body.auth_type,
            provider_details=body.provider_details,
            status=integration_status,
        )
        db.add(integration)
    else:
        integration.base_url = body.base_url
        if encrypted is not None:
            integration.encrypted_api_key = encrypted
            integration.credential_last4 = body.api_key[-4:]
        integration.field_mapping_config = mapping
        integration.auth_type = body.auth_type
        integration.provider_details = body.provider_details
        integration.status = integration_status
    await db.commit()
    await db.refresh(integration)
    return AtsIntegrationRead(
        **{key: getattr(integration, key) for key in ("id", "provider", "base_url", "status", "last_synced_at", "auth_type", "provider_details", "mcp_connection_type")},
        schedule_minutes=body.schedule_minutes,
        masked_key_last4=integration.credential_last4,
        mcp_tools=[tool.get("name", "") for tool in (integration.mcp_tools_cache or {}).get("tools", [])],
    )


@router.get("/integrations", response_model=list[AtsIntegrationRead])
async def list_integrations(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    items = (await db.execute(select(AtsIntegration).where(AtsIntegration.org_id == user.org_id).order_by(AtsIntegration.created_at.desc()))).scalars().all()
    return [AtsIntegrationRead(
        **{key: getattr(item, key) for key in ("id", "provider", "base_url", "status", "last_synced_at", "auth_type", "provider_details", "mcp_connection_type")},
        schedule_minutes=settings.ats_migration_schedule_minutes,
        masked_key_last4=item.credential_last4,
        mcp_tools=[tool.get("name", "") for tool in (item.mcp_tools_cache or {}).get("tools", [])],
    ) for item in items]


@router.post("/integrations/{integration_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def start_sync(
    integration_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    integration = (await db.execute(
        select(AtsIntegration).where(AtsIntegration.id == integration_id, AtsIntegration.org_id == user.org_id)
    )).scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integration.status == "pending_provider_setup":
        raise HTTPException(status_code=409, detail="Provider setup is still pending")
    workflow_id = f"ats-sync-{integration_id}-{uuid4().hex}"
    client = await get_temporal_client()
    await client.start_workflow(
        AtsSyncWorkflow.run,
        AtsSyncInput(
            integration_id=str(integration_id),
            since=integration.last_synced_at.isoformat() if integration.last_synced_at else None,
        ),
        id=workflow_id,
        task_queue="ats-migration",
    )
    integration.status = "syncing"
    await db.commit()
    return {"workflow_id": workflow_id, "status": "queued"}


@router.get("/mcp/providers", response_model=list[AtsMcpProviderRead])
async def list_mcp_providers(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    rows = (await db.execute(
        select(AtsMcpRegistry)
        .where(AtsMcpRegistry.mcp_status.in_(["native_ga", "native_beta"]))
        .order_by(AtsMcpRegistry.ats_name)
    )).scalars().all()
    return rows


@router.post("/mcp/providers/{ats_name}/connect", response_model=AtsIntegrationRead)
async def connect_mcp_provider(
    ats_name: str,
    body: AtsMcpConnectRequest,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    registry = (await db.execute(select(AtsMcpRegistry).where(
        AtsMcpRegistry.ats_name == ats_name,
        AtsMcpRegistry.mcp_status.in_(["native_ga", "native_beta"]),
    ))).scalar_one_or_none()
    if not registry:
        raise HTTPException(status_code=404, detail="This ATS is not currently verified for native MCP")
    if not settings.encryption_key:
        raise HTTPException(status_code=500, detail="Credential encryption is not configured")
    endpoint = body.endpoint_url or registry.mcp_server_url
    if not endpoint:
        raise HTTPException(status_code=422, detail="This provider requires the MCP endpoint created in its admin console")
    from app.core.crypto import encrypt_value
    from app.services.migration.mcp_client import discover_tools
    try:
        discovered = await discover_tools(endpoint, body.access_token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"MCP tool discovery failed: {exc}") from exc
    integration = (await db.execute(select(AtsIntegration).where(
        AtsIntegration.org_id == user.org_id, AtsIntegration.provider == ats_name,
    ))).scalar_one_or_none()
    if integration is None:
        integration = AtsIntegration(
            org_id=user.org_id, provider=ats_name, auth_type=registry.auth_type,
            base_url=endpoint, status="connected", provider_details={"mcp_endpoint_url": endpoint},
        )
        db.add(integration)
    integration.auth_type = registry.auth_type
    integration.base_url = endpoint
    integration.status = "connected"
    integration.mcp_connection_type = "native"
    if registry.auth_type == "api_key":
        integration.encrypted_api_key = encrypt_value(body.access_token, settings.encryption_key)
        integration.credential_last4 = body.access_token[-4:]
        integration.oauth_access_token_encrypted = None
        integration.oauth_refresh_token_encrypted = None
    else:
        integration.oauth_access_token_encrypted = encrypt_value(body.access_token, settings.encryption_key)
        integration.oauth_refresh_token_encrypted = encrypt_value(body.refresh_token, settings.encryption_key) if body.refresh_token else None
    integration.mcp_tools_cache = {"tools": discovered}
    integration.provider_details = {**(integration.provider_details or {}), "mcp_endpoint_url": endpoint}
    await db.commit()
    await db.refresh(integration)
    return AtsIntegrationRead(
        **{key: getattr(integration, key) for key in ("id", "provider", "base_url", "status", "last_synced_at", "auth_type", "provider_details", "mcp_connection_type")},
        schedule_minutes=settings.ats_migration_schedule_minutes,
        mcp_tools=[tool["name"] for tool in discovered],
    )


@router.post("/generic", response_model=AtsIntegrationRead, status_code=status.HTTP_201_CREATED)
async def create_generic_integration(
    body: GenericAtsConfigCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    if body.auth_type == "api_key" and not body.api_key:
        raise HTTPException(status_code=422, detail="api_key is required for API-key authentication")
    if body.auth_type == "oauth2" and not all((body.client_id, body.client_secret, body.authorize_url, body.token_url)):
        raise HTTPException(status_code=422, detail="OAuth2 client and authorize/token URLs are required")
    encrypted = encrypt_value(body.api_key, settings.encryption_key) if body.api_key and settings.encryption_key else None
    encrypted_client_secret = encrypt_value(body.client_secret, settings.encryption_key) if body.client_secret and settings.encryption_key else None
    integration = AtsIntegration(
        org_id=user.org_id, provider="generic", auth_type=body.auth_type,
        encrypted_api_key=encrypted, base_url=body.base_url,
        field_mapping_config=body.field_mapping_config.model_dump(), status="connected",
        provider_details={"client_id": body.client_id, "authorize_url": body.authorize_url, "token_url": body.token_url},
    )
    db.add(integration)
    await db.flush()
    db.add(GenericAtsConfig(
        integration_id=integration.id, display_name=body.display_name,
        candidates_endpoint_path=body.candidates_endpoint_path,
        auth_header_name=body.auth_header_name, pagination_style=body.pagination_style,
        since_param_name=body.since_param_name,
        encrypted_client_secret=encrypted_client_secret,
    ))
    await db.commit()
    await db.refresh(integration)
    return AtsIntegrationRead(
        **{key: getattr(integration, key) for key in ("id", "provider", "base_url", "status", "last_synced_at", "auth_type", "provider_details")},
        schedule_minutes=settings.ats_migration_schedule_minutes,
        masked_key_last4=(body.api_key[-4:] if body.api_key else None),
    )


@router.post("/integrations/{integration_id}/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    integration = (await db.execute(select(AtsIntegration).where(AtsIntegration.id == integration_id, AtsIntegration.org_id == user.org_id))).scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    integration.encrypted_api_key = None
    integration.credential_last4 = None
    integration.oauth_access_token_encrypted = None
    integration.oauth_refresh_token_encrypted = None
    integration.mcp_connection_type = None
    integration.mcp_tools_cache = {}
    integration.status = "disconnected"
    await db.commit()


@router.get("/batches", response_model=list[ImportBatchRead])
async def list_batches(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    return (await db.execute(_batch_query(user.org_id).order_by(ImportBatch.created_at.desc()).limit(100))).scalars().all()


@router.get("/batches/{batch_id}", response_model=ImportBatchDetail)
async def get_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.get("/batches/{batch_id}/preview", response_model=BatchPreviewResponse)
async def preview_import_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return await preview_batch(db, batch)


@router.post("/batches/{batch_id}/retry", response_model=ImportBatchRead, status_code=status.HTTP_201_CREATED)
async def retry_import_batch(
    batch_id: UUID,
    body: BatchRetryRequest,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    selected = [row for row in batch.rows if row.row_status == "error"]
    if body.entity_type:
        selected = [row for row in batch.rows if row.entity_type == body.entity_type and row.row_status == "error"]
    if body.row_ids:
        requested = set(body.row_ids)
        selected = [row for row in batch.rows if row.id in requested and row.row_status == "error"]
    if not selected:
        raise HTTPException(status_code=400, detail="No failed rows matched the retry request")
    records: dict[str, list[dict]] = {}
    for row in selected:
        records.setdefault(row.entity_type, []).append(row.raw_payload)
    retried = await create_pending_batch(db, batch.integration, records, f"retry:{batch.source}")
    await db.refresh(retried, ["integration"])
    return retried


@router.get("/batches/{batch_id}/report")
async def download_batch_report(
    batch_id: UUID,
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    report = {
        "batch_id": batch.id,
        "source": batch.source,
        "status": batch.status,
        "totals": {"total": batch.total_rows, "valid": batch.valid_rows, "flagged": batch.flagged_rows, "errors": batch.error_rows},
        "rows": [{
            "row_id": row.id, "row_number": row.row_number, "entity_type": row.entity_type,
            "final_status": row.row_status, "error_reason": row.error_reason,
            "matched_candidate_id": row.matched_candidate_id,
        } for row in sorted(batch.rows, key=lambda item: (item.entity_type, item.row_number))],
    }
    if format == "json":
        return report
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["row_id", "row_number", "entity_type", "final_status", "error_reason", "matched_candidate_id"])
    writer.writeheader()
    for row in report["rows"]:
        writer.writerow(row)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="otter-hire-batch-{batch.id}.csv"'},
    )


@router.get("/capabilities")
async def provider_capabilities(
    user: User = Depends(require_permission("data_migration:import")),
):
    _enabled()
    registry = load_connector_registry(CONFIG_DIR)
    return [{
        "provider": config.id,
        "display_name": config.name,
        "entities": {entity: endpoint in config.endpoints for entity, endpoint in {
            "jobs": "jobs", "stages": "stages", "candidates": "candidates",
            "applications": "applications", "resumes": "resumes",
            "interviews": "interviews", "notes": "notes",
        }.items()},
        "mapping_template": config.mappings,
    } for config in registry.values() if config.id != "email_export"]


@router.post("/batches/{batch_id}/approve", response_model=BatchCommitResponse)
async def approve_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status != "pending_approval":
        raise HTTPException(status_code=409, detail=f"batch is already {batch.status}")
    workflow_id = f"commit-batch-{batch.id}"
    client = await get_temporal_client()
    await client.start_workflow(
        CommitBatchWorkflow.run,
        CommitBatchInput(batch_id=str(batch.id), actor_id=str(user.id)),
        id=workflow_id,
        task_queue="ats-migration",
    )
    batch.status = "approval_queued"
    await db.commit()
    return BatchCommitResponse(
        batch_id=batch.id,
        status=batch.status,
        committed=0,
        excluded=batch.flagged_rows + batch.error_rows,
    )


@router.post("/batches/{batch_id}/reject", response_model=ImportBatchRead)
async def reject(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    try:
        await reject_batch(db, batch, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return batch
