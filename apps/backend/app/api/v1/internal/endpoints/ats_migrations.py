from __future__ import annotations

import csv
import hashlib
import io
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode, urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from temporalio.client import WorkflowExecutionStatus
from temporalio.service import RPCError, RPCStatusCode

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.permissions import require_permission
from app.db.session import get_db
from app.models.ats_mcp_registry import AtsMcpRegistry
from app.models.ats_migration import AtsIntegration, GenericAtsConfig, ImportBatch
from app.models.user import User
from app.schemas.migration import (
    AtsIntegrationCreate,
    AtsIntegrationRead,
    AtsMcpConnectRequest,
    AtsMcpOAuthStartRequest,
    AtsMcpOAuthStartResponse,
    AtsMcpProviderRead,
    BatchCommitResponse,
    BatchPreviewResponse,
    BatchRetryRequest,
    GenericAtsConfigCreate,
    ImportBatchDetail,
    ImportBatchRead,
)
from app.services.migration.batch_service import create_pending_batch, preview_batch, reject_batch
from app.services.migration.bridge import BRIDGE_PROVIDERS, bridge_tools_for
from app.services.migration.config_loader import load_connector_registry
from app.services.migration.mcp_client import (
    MCP_MAPPED_PROVIDERS,
    assess_import_contract,
    build_mcp_auth,
    discover_tools,
)
from app.services.migration.mcp_oauth import (
    McpOAuthError,
    begin_oauth,
    exchange_code,
    token_expiry,
    validate_mcp_endpoint,
)
from app.services.migration.provider_adapter import adapt_provider_bundle
from app.services.migration.provider_auth import (
    ProviderConnectionError,
    issue_greenhouse_access_token,
    validate_provider_base_url,
    validate_provider_connection,
)
from app.temporal.client import get_temporal_client
from app.temporal.migration.types import AtsSyncInput, CommitBatchInput
from app.temporal.migration.workflows import AtsSyncWorkflow, CommitBatchWorkflow

router = APIRouter(prefix="/ats-migrations", tags=["ats-migrations"])
CONFIG_DIR = Path(__file__).resolve().parents[4] / "migration_configs"
NAMED_PROVIDERS = {
    "greenhouse",
    "lever",
    "recruiterbox",
    "smartrecruiters",
    "bamboohr",
    "workable",
    "otter_local",
}
PENDING_PROVIDERS = {"workday", "icims"}
MCP_OAUTH_STATE_TTL = timedelta(minutes=10)
MCP_MIGRATION_READY_PROVIDERS = MCP_MAPPED_PROVIDERS


def _enabled() -> None:
    if not settings.ats_auto_import_enabled:
        raise HTTPException(status_code=404, detail="ATS auto-import is disabled")


def _mcp_callback_url() -> str:
    return f"{settings.external_api_base_url}/v1/internal/ats-migrations/mcp/oauth/callback"


def _mcp_redirect(*, provider: str, result: str, detail: str | None = None) -> RedirectResponse:
    params = {"mcp": result, "provider": provider}
    if detail:
        params["detail"] = detail
    url = f"{settings.frontend_base_url.rstrip('/')}/data-migration?{urlencode(params)}"
    return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)


def _pinpoint_account_host(value: str | None) -> str:
    raw = (value or "").strip().rstrip("/")
    if not raw:
        raise HTTPException(status_code=422, detail="Pinpoint requires the company account host")
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https"
        or not host.endswith(".pinpointhq.com")
        or host == "pinpointhq.com"
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(
            status_code=422,
            detail="Use the Pinpoint company host, for example company.pinpointhq.com",
        )
    return host


def _public_provider_details(details: dict | None) -> dict:
    return {
        key: value
        for key, value in (details or {}).items()
        if not str(key).startswith("_mcp_oauth_")
    }


def _stored_mcp_endpoint(integration: AtsIntegration) -> str:
    if integration.mcp_endpoint_encrypted:
        if not settings.encryption_key:
            raise McpOAuthError("Credential encryption is not configured")
        return decrypt_value(integration.mcp_endpoint_encrypted, settings.encryption_key)
    return str((integration.provider_details or {}).get("mcp_endpoint_url") or integration.base_url)


def _batch_query(org_id: UUID):
    return (
        select(ImportBatch)
        .join(AtsIntegration)
        .options(selectinload(ImportBatch.integration), selectinload(ImportBatch.rows))
        .where(AtsIntegration.org_id == org_id)
    )


def _integration_read(
    integration: AtsIntegration,
    *,
    schedule_minutes: int | None = None,
) -> AtsIntegrationRead:
    details = _public_provider_details(integration.provider_details)
    return AtsIntegrationRead(
        id=integration.id,
        provider=integration.provider,
        connection_type=integration.connection_type,
        base_url=integration.base_url,
        status=integration.status,
        last_synced_at=integration.last_synced_at,
        auth_type=integration.auth_type,
        provider_details=details,
        mcp_connection_type=integration.mcp_connection_type,
        schedule_minutes=schedule_minutes or settings.ats_migration_schedule_minutes,
        masked_key_last4=integration.credential_last4,
        mcp_tools=[
            tool.get("name", "") for tool in (integration.mcp_tools_cache or {}).get("tools", [])
        ],
        bridge_tools=list(details.get("bridge_tools") or []),
    )


async def _upsert_provider_integration(
    body: AtsIntegrationCreate,
    *,
    connection_type: str,
    user: User,
    db: AsyncSession,
) -> AtsIntegrationRead:
    connector = load_connector_registry(CONFIG_DIR).get(body.provider)
    allowed_providers = (
        BRIDGE_PROVIDERS
        if connection_type == "smartats_bridge"
        else NAMED_PROVIDERS | PENDING_PROVIDERS
    )
    if body.provider not in allowed_providers or (
        connector is None and body.provider not in PENDING_PROVIDERS
    ):
        raise HTTPException(status_code=400, detail="Unknown or disabled connector")
    provider_details = dict(body.provider_details)
    base_url = body.base_url
    credential = (body.api_key or "").strip() or None
    if body.provider not in PENDING_PROVIDERS | {"otter_local"}:
        try:
            base_url = validate_provider_base_url(body.provider, body.base_url)
            if not credential:
                raise ProviderConnectionError("A provider credential is required")
            validation_secret = credential
            if body.provider == "greenhouse":
                client_id = str(provider_details.get("client_id") or "").strip()
                if not client_id:
                    raise ProviderConnectionError(
                        "Greenhouse requires an OAuth client ID and client secret"
                    )
                provider_details["client_id"] = client_id
                validation_secret = await issue_greenhouse_access_token(
                    client_id,
                    credential,
                    str(provider_details["organization_id"])
                    if provider_details.get("organization_id")
                    else None,
                )
            await validate_provider_connection(
                body.provider,
                connector.model_copy(update={"base_url": base_url}),
                base_url,
                validation_secret,
            )
        except ProviderConnectionError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    encrypted = None
    if credential:
        if not settings.encryption_key:
            raise HTTPException(status_code=500, detail="Credential encryption is not configured")
        encrypted = encrypt_value(credential, settings.encryption_key)
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.org_id == user.org_id,
                AtsIntegration.provider == body.provider,
                AtsIntegration.connection_type == connection_type,
            )
        )
    ).scalar_one_or_none()
    mapping = dict(connector.mappings if connector else {})
    for entity, fields in body.field_mapping_config.model_dump().items():
        if fields:
            mapping[entity] = fields
    integration_status = (
        "pending_provider_setup" if body.provider in PENDING_PROVIDERS else "connected"
    )
    if connection_type == "smartats_bridge" and connector:
        provider_details.update(
            {
                "bridge_read_only": True,
                "bridge_tools": bridge_tools_for(connector),
            }
        )
    if integration is None:
        integration = AtsIntegration(
            org_id=user.org_id,
            provider=body.provider,
            connection_type=connection_type,
            base_url=base_url,
            encrypted_api_key=encrypted,
            credential_last4=credential[-4:] if credential else None,
            field_mapping_config=mapping,
            auth_type=body.auth_type,
            provider_details=provider_details,
            status=integration_status,
        )
        db.add(integration)
    else:
        integration.base_url = base_url
        if encrypted is not None:
            integration.encrypted_api_key = encrypted
            integration.credential_last4 = credential[-4:]
        integration.field_mapping_config = mapping
        integration.auth_type = body.auth_type
        integration.provider_details = provider_details
        integration.status = integration_status
    await db.commit()
    await db.refresh(integration)
    return _integration_read(integration, schedule_minutes=body.schedule_minutes)


@router.post(
    "/integrations", response_model=AtsIntegrationRead, status_code=status.HTTP_201_CREATED
)
async def create_integration(
    body: AtsIntegrationCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    return await _upsert_provider_integration(
        body,
        connection_type="api",
        user=user,
        db=db,
    )


@router.post(
    "/bridge/integrations",
    response_model=AtsIntegrationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_bridge_integration(
    body: AtsIntegrationCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    return await _upsert_provider_integration(
        body,
        connection_type="smartats_bridge",
        user=user,
        db=db,
    )


@router.get("/integrations", response_model=list[AtsIntegrationRead])
async def list_integrations(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    items = (
        (
            await db.execute(
                select(AtsIntegration)
                .where(AtsIntegration.org_id == user.org_id)
                .order_by(AtsIntegration.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_integration_read(item) for item in items]


@router.post("/integrations/{integration_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def start_sync(
    integration_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.id == integration_id, AtsIntegration.org_id == user.org_id
            )
        )
    ).scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    if integration.status == "pending_provider_setup":
        raise HTTPException(status_code=409, detail="Provider setup is still pending")
    if integration.status == "syncing":
        workflow_id = (integration.provider_details or {}).get("sync_workflow_id")
        if workflow_id:
            return {"workflow_id": workflow_id, "status": "queued"}
        raise HTTPException(status_code=409, detail="A sync is already running")
    if integration.mcp_connection_type and not bool(
        (integration.provider_details or {}).get("mcp_import_contract", {}).get("ready")
    ):
        missing = (
            (integration.provider_details or {})
            .get("mcp_import_contract", {})
            .get("missing_entities", [])
        )
        suffix = f": {', '.join(missing)}" if missing else ""
        raise HTTPException(
            status_code=409,
            detail=f"The MCP server is connected but required import tools are missing{suffix}",
        )
    pending_batch = (
        await db.execute(
            select(ImportBatch.id)
            .where(
                ImportBatch.integration_id == integration.id,
                ImportBatch.status.in_(["pending_approval", "approval_queued"]),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if pending_batch:
        return {"batch_id": str(pending_batch), "status": "pending_approval"}
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
    integration.provider_details = {
        **(integration.provider_details or {}),
        "sync_workflow_id": workflow_id,
    }
    await db.commit()
    return {"workflow_id": workflow_id, "status": "queued"}


@router.get("/integrations/{integration_id}/sync/{workflow_id}")
async def sync_status(
    integration_id: UUID,
    workflow_id: str,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.id == integration_id,
                AtsIntegration.org_id == user.org_id,
            )
        )
    ).scalar_one_or_none()
    if not integration or not workflow_id.startswith(f"ats-sync-{integration_id}-"):
        raise HTTPException(status_code=404, detail="Sync not found")
    client = await get_temporal_client()
    handle = client.get_workflow_handle(workflow_id)
    try:
        description = await handle.describe()
        if description.status == WorkflowExecutionStatus.COMPLETED:
            # The fetch workflow returns the review batch; it never commits ATS records.
            return {**await handle.result(), "workflow_id": workflow_id}
    except RPCError as exc:
        if exc.status == RPCStatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Sync not found") from exc
        raise
    if description.status == WorkflowExecutionStatus.RUNNING:
        return {"status": "syncing", "workflow_id": workflow_id}
    return {
        "status": "failed",
        "error": (integration.provider_details or {}).get("last_sync_error")
        or "The provider sync did not complete. Please try again.",
    }


@router.get("/mcp/providers", response_model=list[AtsMcpProviderRead])
async def list_mcp_providers(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    rows = (
        (
            await db.execute(
                select(AtsMcpRegistry)
                .where(AtsMcpRegistry.mcp_status.in_(["native_ga", "native_beta"]))
                .order_by(AtsMcpRegistry.ats_name)
            )
        )
        .scalars()
        .all()
    )
    return [
        AtsMcpProviderRead(
            ats_name=row.ats_name,
            mcp_status=row.mcp_status,
            mcp_server_url=row.mcp_server_url,
            auth_type="api_key" if row.ats_name == "pinpoint" else row.auth_type,
            last_verified_date=row.last_verified_date,
            notes=row.notes,
            supported_operations=row.supported_operations or [],
            connection_ready=row.ats_name in MCP_MIGRATION_READY_PROVIDERS,
            connection_note=(
                "Automated migration mapping is not available for this provider."
                if row.ats_name not in MCP_MIGRATION_READY_PROVIDERS
                else "Requires paginated, unfiltered access to Jobs, Candidates and Applications; search-only toolsets cannot migrate all records."
                if row.ats_name == "zoho_recruit"
                else "Requires recruitment and applicant-progress read tools. Tool compatibility is checked on connection."
                if row.ats_name == "ninehire"
                else "Uses X-API-KEY and X-Original-Host headers; it is not an OAuth server."
                if row.ats_name == "pinpoint"
                else "OAuth opens in the provider and returns to SmartATS automatically."
                if row.auth_type == "oauth"
                else "Requires the provider-issued MCP bearer key."
            ),
        )
        for row in rows
    ]


@router.post(
    "/mcp/providers/{ats_name}/oauth/start",
    response_model=AtsMcpOAuthStartResponse,
)
async def start_mcp_oauth(
    ats_name: str,
    body: AtsMcpOAuthStartRequest,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    if not settings.encryption_key:
        raise HTTPException(status_code=500, detail="Credential encryption is not configured")
    registry = (
        await db.execute(
            select(AtsMcpRegistry).where(
                AtsMcpRegistry.ats_name == ats_name,
                AtsMcpRegistry.mcp_status.in_(["native_ga", "native_beta"]),
            )
        )
    ).scalar_one_or_none()
    if not registry:
        raise HTTPException(status_code=404, detail="MCP provider not found")
    if registry.auth_type != "oauth" or ats_name == "pinpoint":
        raise HTTPException(status_code=409, detail="This MCP provider does not use OAuth")
    endpoint = body.endpoint_url or registry.mcp_server_url
    if not endpoint:
        raise HTTPException(
            status_code=422,
            detail="Paste the MCP endpoint created in the provider console",
        )
    try:
        endpoint = validate_mcp_endpoint(endpoint)
        oauth = await begin_oauth(endpoint, _mcp_callback_url())
    except McpOAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.org_id == user.org_id,
                AtsIntegration.provider == ats_name,
                AtsIntegration.connection_type == "native_mcp",
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        integration = AtsIntegration(
            org_id=user.org_id,
            provider=ats_name,
            connection_type="native_mcp",
            auth_type="oauth",
            base_url=endpoint,
        )
        db.add(integration)

    client_info = dict(oauth.client)
    client_secret = client_info.pop("client_secret", None)
    endpoint_has_embedded_secret = registry.mcp_server_url is None
    endpoint_origin = urlparse(endpoint)
    integration.auth_type = "oauth"
    integration.base_url = (
        f"{endpoint_origin.scheme}://{endpoint_origin.netloc}"
        if endpoint_has_embedded_secret
        else endpoint
    )
    integration.mcp_endpoint_encrypted = (
        encrypt_value(endpoint, settings.encryption_key) if endpoint_has_embedded_secret else None
    )
    integration.status = "authorizing"
    integration.mcp_connection_type = "native"
    integration.encrypted_api_key = (
        encrypt_value(str(client_secret), settings.encryption_key) if client_secret else None
    )
    integration.credential_last4 = None
    integration.oauth_access_token_encrypted = None
    integration.oauth_refresh_token_encrypted = None
    integration.mcp_tools_cache = {}
    integration.provider_details = {
        **_public_provider_details(integration.provider_details),
        **({} if endpoint_has_embedded_secret else {"mcp_endpoint_url": endpoint}),
        "_mcp_oauth_state_hash": hashlib.sha256(oauth.state.encode()).hexdigest(),
        "_mcp_oauth_code_verifier": encrypt_value(oauth.code_verifier, settings.encryption_key),
        "_mcp_oauth_expires_at": (datetime.now(UTC) + MCP_OAUTH_STATE_TTL).isoformat(),
        "_mcp_oauth_metadata": oauth.metadata,
        "_mcp_oauth_client": client_info,
    }
    await db.commit()
    return AtsMcpOAuthStartResponse(authorization_url=oauth.authorization_url)


@router.get("/mcp/oauth/callback")
async def mcp_oauth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    state_value = request.query_params.get("state")
    code = request.query_params.get("code")
    oauth_error = request.query_params.get("error")
    if not state_value:
        return _mcp_redirect(provider="unknown", result="error", detail="Missing OAuth state")
    state_hash = hashlib.sha256(state_value.encode()).hexdigest()
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.provider_details["_mcp_oauth_state_hash"].as_string() == state_hash,
                AtsIntegration.status == "authorizing",
                AtsIntegration.connection_type == "native_mcp",
            )
        )
    ).scalar_one_or_none()
    if not integration:
        return _mcp_redirect(
            provider="unknown", result="error", detail="OAuth session was not found"
        )
    provider = integration.provider
    details = dict(integration.provider_details or {})
    if oauth_error:
        integration.status = "authorization_failed"
        await db.commit()
        return _mcp_redirect(provider=provider, result="error", detail="Authorization denied")
    if not code or not settings.encryption_key:
        integration.status = "authorization_failed"
        await db.commit()
        return _mcp_redirect(provider=provider, result="error", detail="Invalid OAuth response")
    try:
        expires_at = datetime.fromisoformat(str(details["_mcp_oauth_expires_at"]))
        if datetime.now(UTC) > expires_at:
            raise McpOAuthError("OAuth session expired; connect again")
        code_verifier = decrypt_value(
            str(details["_mcp_oauth_code_verifier"]), settings.encryption_key
        )
        client_info = dict(details["_mcp_oauth_client"])
        if integration.encrypted_api_key:
            client_info["client_secret"] = decrypt_value(
                integration.encrypted_api_key, settings.encryption_key
            )
        metadata = dict(details["_mcp_oauth_metadata"])
        token = await exchange_code(
            code=code,
            code_verifier=code_verifier,
            callback_url=_mcp_callback_url(),
            metadata=metadata,
            client_info=client_info,
        )
        discovered = await discover_tools(_stored_mcp_endpoint(integration), token.access_token)
        contract = assess_import_contract(discovered, provider=provider)
    except McpOAuthError as exc:
        integration.status = "authorization_failed"
        await db.commit()
        return _mcp_redirect(provider=provider, result="error", detail=str(exc))
    except Exception:
        integration.status = "authorization_failed"
        await db.commit()
        return _mcp_redirect(
            provider=provider,
            result="error",
            detail="MCP authorization completed, but tool verification failed",
        )

    integration.oauth_access_token_encrypted = encrypt_value(
        token.access_token, settings.encryption_key
    )
    integration.oauth_refresh_token_encrypted = (
        encrypt_value(token.refresh_token, settings.encryption_key) if token.refresh_token else None
    )
    integration.mcp_tools_cache = {"tools": discovered}
    integration.status = "connected" if contract["ready"] else "connected_limited"
    integration.provider_details = {
        **_public_provider_details(details),
        **(
            {} if integration.mcp_endpoint_encrypted else {"mcp_endpoint_url": integration.base_url}
        ),
        "mcp_oauth_metadata": metadata,
        "mcp_oauth_client": details["_mcp_oauth_client"],
        "mcp_token_expires_at": token_expiry(token.expires_in),
        "mcp_import_contract": contract,
    }
    await db.commit()
    return _mcp_redirect(
        provider=provider,
        result="connected" if contract["ready"] else "limited",
        detail=(
            None
            if contract["ready"]
            else f"Missing import tools: {', '.join(contract['missing_entities'])}"
        ),
    )


@router.post("/mcp/providers/{ats_name}/connect", response_model=AtsIntegrationRead)
async def connect_mcp_provider(
    ats_name: str,
    body: AtsMcpConnectRequest,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    registry = (
        await db.execute(
            select(AtsMcpRegistry).where(
                AtsMcpRegistry.ats_name == ats_name,
                AtsMcpRegistry.mcp_status.in_(["native_ga", "native_beta"]),
            )
        )
    ).scalar_one_or_none()
    if not registry:
        raise HTTPException(
            status_code=404, detail="This ATS is not currently verified for native MCP"
        )
    if not settings.encryption_key:
        raise HTTPException(status_code=500, detail="Credential encryption is not configured")
    registry_auth_type = "api_key" if ats_name == "pinpoint" else registry.auth_type
    if registry_auth_type == "oauth":
        raise HTTPException(
            status_code=409,
            detail="Start the provider OAuth flow instead of pasting an access token",
        )
    endpoint = body.endpoint_url or registry.mcp_server_url
    if not endpoint:
        raise HTTPException(
            status_code=422,
            detail="This provider requires the MCP endpoint created in its admin console",
        )
    try:
        endpoint = validate_mcp_endpoint(endpoint)
        details: dict[str, str] = {"mcp_endpoint_url": endpoint}
        if ats_name == "pinpoint":
            details["mcp_account_host"] = _pinpoint_account_host(body.account_host)
        bearer, extra_headers = build_mcp_auth(ats_name, body.access_token, details)
        discovered = await discover_tools(endpoint, bearer, extra_headers=extra_headers)
        contract = assess_import_contract(discovered, body.tool_mapping, provider=ats_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"MCP tool discovery failed: {exc}") from exc
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.org_id == user.org_id,
                AtsIntegration.provider == ats_name,
                AtsIntegration.connection_type == "native_mcp",
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        integration = AtsIntegration(
            org_id=user.org_id,
            provider=ats_name,
            connection_type="native_mcp",
            auth_type=registry_auth_type,
            base_url=endpoint,
            status="connected" if contract["ready"] else "connected_limited",
            provider_details=details,
        )
        db.add(integration)
    integration.auth_type = registry_auth_type
    integration.base_url = endpoint
    integration.mcp_endpoint_encrypted = None
    integration.status = "connected" if contract["ready"] else "connected_limited"
    integration.mcp_connection_type = "native"
    integration.encrypted_api_key = encrypt_value(body.access_token, settings.encryption_key)
    integration.credential_last4 = body.access_token[-4:]
    integration.oauth_access_token_encrypted = None
    integration.oauth_refresh_token_encrypted = None
    integration.mcp_tools_cache = {"tools": discovered}
    integration.provider_details = {
        **_public_provider_details(integration.provider_details),
        **details,
        "mcp_tool_mapping": body.tool_mapping,
        "mcp_import_contract": contract,
    }
    await db.commit()
    await db.refresh(integration)
    return _integration_read(integration)


@router.post("/generic", response_model=AtsIntegrationRead, status_code=status.HTTP_201_CREATED)
async def create_generic_integration(
    body: GenericAtsConfigCreate,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    if body.auth_type != "none" and not body.api_key:
        raise HTTPException(
            status_code=422,
            detail="A static API key, bearer token, Basic credential, or OAuth access token is required",
        )
    encrypted = (
        encrypt_value(body.api_key, settings.encryption_key)
        if body.api_key and settings.encryption_key
        else None
    )
    encrypted_client_secret = (
        encrypt_value(body.client_secret, settings.encryption_key)
        if body.client_secret and settings.encryption_key
        else None
    )
    integration = AtsIntegration(
        org_id=user.org_id,
        provider="generic",
        connection_type="api",
        auth_type=body.auth_type,
        encrypted_api_key=encrypted,
        base_url=body.base_url,
        field_mapping_config=body.field_mapping_config.model_dump(),
        status="connected",
        provider_details={
            "client_id": body.client_id,
            "authorize_url": body.authorize_url,
            "token_url": body.token_url,
        },
    )
    db.add(integration)
    await db.flush()
    db.add(
        GenericAtsConfig(
            integration_id=integration.id,
            display_name=body.display_name,
            candidates_endpoint_path=body.candidates_endpoint_path,
            auth_header_name=body.auth_header_name,
            pagination_style=body.pagination_style,
            since_param_name=body.since_param_name,
            endpoint_config=body.endpoint_config,
            encrypted_client_secret=encrypted_client_secret,
        )
    )
    await db.commit()
    await db.refresh(integration)
    return _integration_read(integration)


@router.post("/integrations/{integration_id}/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    integration = (
        await db.execute(
            select(AtsIntegration).where(
                AtsIntegration.id == integration_id, AtsIntegration.org_id == user.org_id
            )
        )
    ).scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    integration.encrypted_api_key = None
    integration.credential_last4 = None
    integration.oauth_access_token_encrypted = None
    integration.oauth_refresh_token_encrypted = None
    integration.mcp_connection_type = None
    integration.mcp_endpoint_encrypted = None
    integration.mcp_tools_cache = {}
    integration.provider_details = {
        key: value
        for key, value in (integration.provider_details or {}).items()
        if not str(key).startswith("mcp_") and not str(key).startswith("_mcp_")
    }
    integration.status = "disconnected"
    await db.commit()


@router.get("/batches", response_model=list[ImportBatchRead])
async def list_batches(
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    return (
        (
            await db.execute(
                _batch_query(user.org_id).order_by(ImportBatch.created_at.desc()).limit(100)
            )
        )
        .scalars()
        .all()
    )


@router.get("/batches/{batch_id}", response_model=ImportBatchDetail)
async def get_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.delete("/batches/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status == "approval_queued":
        raise HTTPException(
            status_code=409,
            detail="Wait for the queued import to finish before removing it from history",
        )
    await db.execute(delete(ImportBatch).where(ImportBatch.id == batch.id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/batches/{batch_id}/preview", response_model=BatchPreviewResponse)
async def preview_import_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:import")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return await preview_batch(db, batch)


@router.post(
    "/batches/{batch_id}/retry", response_model=ImportBatchRead, status_code=status.HTTP_201_CREATED
)
async def retry_import_batch(
    batch_id: UUID,
    body: BatchRetryRequest,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    selected = [row for row in batch.rows if row.row_status == "error"]
    if body.entity_type:
        selected = [
            row
            for row in batch.rows
            if row.entity_type == body.entity_type and row.row_status == "error"
        ]
    if body.row_ids:
        requested = set(body.row_ids)
        selected = [row for row in batch.rows if row.id in requested and row.row_status == "error"]
    if not selected:
        raise HTTPException(status_code=400, detail="No failed rows matched the retry request")
    records: dict[str, list[dict]] = {}
    for row in selected:
        records.setdefault(row.entity_type, []).append(row.raw_payload)
    records = adapt_provider_bundle(batch.integration.provider, records)
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
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    report = {
        "batch_id": batch.id,
        "source": batch.source,
        "status": batch.status,
        "totals": {
            "total": batch.total_rows,
            "valid": batch.valid_rows,
            "flagged": batch.flagged_rows,
            "errors": batch.error_rows,
        },
        "warnings": batch.warnings or [],
        "rows": [
            {
                "row_id": row.id,
                "row_number": row.row_number,
                "entity_type": row.entity_type,
                "final_status": row.row_status,
                "error_reason": row.error_reason,
                "matched_candidate_id": row.matched_candidate_id,
                "result_status": row.result_status,
                "result_record_id": row.result_record_id,
                "result_reason": row.result_reason,
                "mapped_payload": row.mapped_payload,
            }
            for row in sorted(batch.rows, key=lambda item: (item.entity_type, item.row_number))
        ],
    }
    if format == "json":
        return report
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "row_id",
            "row_number",
            "entity_type",
            "final_status",
            "error_reason",
            "matched_candidate_id",
            "result_status",
            "result_record_id",
            "result_reason",
            "mapped_payload",
        ],
    )
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
    return [
        {
            "provider": config.id,
            "display_name": config.name,
            "entities": {
                entity: endpoint in config.endpoints
                for entity, endpoint in {
                    "jobs": "jobs",
                    "stages": "stages",
                    "candidates": "candidates",
                    "applications": "applications",
                    "resumes": "resumes",
                    "interviews": "interviews",
                    "notes": "notes",
                }.items()
            },
            "mapping_template": config.mappings,
        }
        for config in registry.values()
        if config.id != "email_export"
    ]


@router.post("/batches/{batch_id}/approve", response_model=BatchCommitResponse)
async def approve_batch(
    batch_id: UUID,
    user: User = Depends(require_permission("data_migration:manage")),
    db: AsyncSession = Depends(get_db),
):
    _enabled()
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status not in {"pending_approval", "failed", "approval_queued"}:
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
    batch = (
        await db.execute(_batch_query(user.org_id).where(ImportBatch.id == batch_id))
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    try:
        await reject_batch(db, batch, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return batch
