from __future__ import annotations

import base64
import logging
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import select
from temporalio import activity

from app.core.config import settings
from app.core.crypto import decrypt_value
from app.db.session import AsyncSessionLocal
from app.models.ats_migration import AtsIntegration, GenericAtsConfig, ImportBatch
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.services.migration.batch_service import commit_batch, create_pending_batch
from app.services.migration.config_loader import load_connector_registry
from app.services.migration.fetcher import GenericFetcher
from app.services.migration.mcp_client import fetch_entity_bundle_from_mcp
from app.services.storage import storage_service
from app.temporal.migration.types import AtsSyncInput, CommitBatchInput

logger = logging.getLogger("ats_migration_worker")
CONFIG_DIR = Path(__file__).resolve().parents[3] / "migration_configs"


@activity.defn(name="transfer_resume_attachment")
async def transfer_resume_attachment(input_data: dict) -> dict:
    """Download or decode one source file, then use the existing candidate storage path."""
    content = base64.b64decode(input_data["content_base64"]) if input_data.get("content_base64") else None
    if content is None and input_data.get("source_url"):
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(input_data["source_url"])
            response.raise_for_status()
            content = response.content
    if not content:
        raise ValueError("resume attachment has no content or source URL")
    candidate_id = input_data["candidate_id"]
    document_id = input_data.get("external_document_id") or str(UUID(int=0))
    safe_name = Path(input_data.get("filename") or "resume.bin").name
    object_key = f"orgs/{input_data['org_id']}/candidates/{candidate_id}/documents/{document_id}_{safe_name}"
    mime_type = input_data.get("mime_type") or "application/octet-stream"
    await storage_service.write_bytes(object_key, content, mime_type)
    url = await storage_service.resolve_url(object_key)
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(CandidateDocument).where(
            CandidateDocument.org_id == UUID(input_data["org_id"]),
            CandidateDocument.external_document_id == input_data.get("external_document_id"),
        ))).scalar_one_or_none() if input_data.get("external_document_id") else None
        document = existing or CandidateDocument(
            org_id=UUID(input_data["org_id"]), candidate_id=UUID(candidate_id),
            job_id=UUID(input_data["job_id"]) if input_data.get("job_id") else None,
            external_document_id=input_data.get("external_document_id"),
            field_key=input_data.get("field_key", "resume"), field_label_snapshot="Resume",
            doc_type=input_data.get("doc_type", "resume"), name=safe_name, url=url,
            object_key=object_key, mime_type=mime_type, size_bytes=len(content),
        )
        if existing:
            document.url, document.object_key, document.size_bytes = url, object_key, len(content)
        db.add(document)
        await db.commit()
        return {"document_id": str(document.id), "external_document_id": document.external_document_id, "object_key": object_key}


@activity.defn(name="fetch_candidates")
async def fetch_candidates(input_data: AtsSyncInput) -> list[dict]:
    async with AsyncSessionLocal() as db:
        integration = (await db.execute(select(AtsIntegration).where(AtsIntegration.id == UUID(input_data.integration_id)))).scalar_one()
        if integration.mcp_connection_type:
            encrypted_token = integration.oauth_access_token_encrypted or integration.encrypted_api_key
            if not encrypted_token:
                raise ValueError("MCP integration has no encrypted access token")
            if not settings.encryption_key:
                raise ValueError("Credential encryption is not configured")
            access_token = decrypt_value(encrypted_token, settings.encryption_key)
            endpoint_url = integration.provider_details.get("mcp_endpoint_url") or integration.base_url
            return await fetch_entity_bundle_from_mcp(endpoint_url, access_token, integration.mcp_tools_cache, input_data.since)
        config = load_connector_registry(CONFIG_DIR).get(integration.provider)
        if config is None:
            raise ValueError(f"No connector config registered for {integration.provider}")
        if integration.provider == "generic":
            generic = (await db.execute(select(GenericAtsConfig).where(GenericAtsConfig.integration_id == integration.id))).scalar_one()
            config = config.model_copy(update={
                "base_url": integration.base_url,
                "auth": config.auth.model_copy(update={"type": integration.auth_type, "header_name": generic.auth_header_name}),
                "endpoints": {"candidates": {"path": generic.candidates_endpoint_path, "method": "GET"}},
                "pagination": config.pagination.model_copy(update={"style": generic.pagination_style, "since_param_name": generic.since_param_name}),
                "mappings": integration.field_mapping_config,
            })
        secret = None
        if integration.encrypted_api_key:
            if not settings.encryption_key:
                raise ValueError("Credential encryption is not configured")
            secret = decrypt_value(integration.encrypted_api_key, settings.encryption_key)
        since = input_data.since
        configured_entities = {
            "job": "jobs", "stage": "stages", "candidate": "candidates",
            "application": "applications", "resume": "resumes", "interview": "interviews", "note": "notes",
        }
        bundle: dict[str, list[dict]] = {}
        fetcher = GenericFetcher(config.model_copy(update={"base_url": integration.base_url}), secret)
        for entity, endpoint_name in configured_entities.items():
            if endpoint_name in config.endpoints:
                bundle[entity] = [record async for record in fetcher.records(endpoint_name, since=since)]
        return bundle or {"candidate": []}


@activity.defn(name="validate_and_map_batch")
async def validate_and_map_batch(input_data: dict) -> dict:
    async with AsyncSessionLocal() as db:
        integration = (await db.execute(select(AtsIntegration).where(AtsIntegration.id == UUID(input_data["integration_id"])))).scalar_one()
        batch = await create_pending_batch(db, integration, input_data["raw_records"], input_data.get("source", integration.provider))
        return {"batch_id": str(batch.id), "status": batch.status, "total_rows": batch.total_rows}


@activity.defn(name="commit_batch")
async def commit_batch_activity(input_data: CommitBatchInput) -> dict:
    async with AsyncSessionLocal() as db:
        batch = (await db.execute(
            select(ImportBatch).where(ImportBatch.id == UUID(input_data.batch_id)).with_for_update()
        )).scalar_one()
        # Load relationships explicitly before the transaction uses them.
        await db.refresh(batch, ["integration", "rows"])
        result = await commit_batch(db, batch, UUID(input_data.actor_id))
        resume_rows = [row for row in batch.rows if row.entity_type == "resume" and row.row_status == "valid" and row.mapped_payload]
        for row in resume_rows:
            payload = row.mapped_payload or {}
            candidate = (await db.execute(select(Candidate).where(
                Candidate.org_id == batch.integration.org_id,
                Candidate.external_candidate_id == str(payload.get("external_candidate_id")),
            ))).scalar_one_or_none()
            if not candidate:
                result["unresolved_errors"] += 1
                continue
            try:
                await transfer_resume_attachment({
                    **payload,
                    "org_id": str(batch.integration.org_id),
                    "candidate_id": str(candidate.id),
                })
                result["resumes_transferred"] = result.get("resumes_transferred", 0) + 1
            except Exception:
                logger.exception("Resume transfer failed for batch row %s", row.id)
                result["unresolved_errors"] += 1
        await send_import_complete_email(batch, result)
        return {"batch_id": input_data.batch_id, "status": batch.status, **result}


@activity.defn(name="send_import_complete_email")
async def send_import_complete_email_activity(input_data: dict) -> dict:
    if not settings.is_production and settings.ses_local_mock:
        logger.info(
            "[LOCAL SES MOCK] import complete batch=%s provider=%s committed=%s excluded=%s",
            input_data.get("batch_id"), input_data.get("provider"),
            input_data.get("committed", 0), input_data.get("excluded", 0),
        )
        return {"status": "mocked"}
    raise RuntimeError("Real SES delivery is disabled for this local implementation")


async def send_import_complete_email(batch: ImportBatch, result: dict) -> None:
    await send_import_complete_email_activity(
        {"batch_id": str(batch.id), "provider": batch.integration.provider, **result}
    )
