from __future__ import annotations

import base64
import hashlib
import logging
import mimetypes
import string
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from temporalio import activity

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.db.session import AsyncSessionLocal
from app.models.ats_migration import AtsIntegration, GenericAtsConfig, ImportAuditLog, ImportBatch
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.models.job_application import JobApplication
from app.services.migration.batch_service import commit_batch, create_pending_batch
from app.services.migration.config_loader import get_path, load_connector_registry
from app.services.migration.fetcher import GenericFetcher
from app.services.migration.mcp_client import build_mcp_auth, fetch_entity_bundle_from_mcp
from app.services.migration.mcp_oauth import refresh_access_token, token_expiry
from app.services.migration.provider_adapter import adapt_provider_bundle
from app.services.migration.provider_auth import resolve_provider_secret
from app.services.storage import storage_service
from app.temporal.migration.types import AtsSyncInput, CommitBatchInput
from app.temporal.resume_parsing.queue import enqueue_job_apply_resume_parse
from app.temporal.resume_parsing.types import JobApplyResumeParseInput

logger = logging.getLogger("ats_migration_worker")
CONFIG_DIR = Path(__file__).resolve().parents[2] / "migration_configs"
RESUME_MIME_TYPES = {
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
    ".rtf": "application/rtf",
    ".txt": "text/plain",
}


@activity.defn(name="transfer_resume_attachment")
async def transfer_resume_attachment(input_data: dict) -> dict:
    """Download or decode one source file, then use the existing candidate storage path."""
    content = (
        base64.b64decode(input_data["content_base64"]) if input_data.get("content_base64") else None
    )
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
    object_key = (
        f"orgs/{input_data['org_id']}/candidates/{candidate_id}/documents/{document_id}_{safe_name}"
    )
    provided_mime = str(input_data.get("mime_type") or "").strip()
    guessed_mime = RESUME_MIME_TYPES.get(Path(safe_name).suffix.lower())
    guessed_mime = guessed_mime or mimetypes.guess_type(safe_name)[0]
    mime_type = provided_mime if "/" in provided_mime else guessed_mime
    mime_type = mime_type or "application/octet-stream"
    await storage_service.write_bytes(object_key, content, mime_type)
    url = await storage_service.resolve_url(object_key)
    async with AsyncSessionLocal() as db:
        existing = (
            (
                await db.execute(
                    select(CandidateDocument).where(
                        CandidateDocument.org_id == UUID(input_data["org_id"]),
                        CandidateDocument.external_document_id
                        == input_data.get("external_document_id"),
                    )
                )
            ).scalar_one_or_none()
            if input_data.get("external_document_id")
            else None
        )
        document = existing or CandidateDocument(
            org_id=UUID(input_data["org_id"]),
            candidate_id=UUID(candidate_id),
            job_id=UUID(input_data["job_id"]) if input_data.get("job_id") else None,
            external_document_id=input_data.get("external_document_id"),
            field_key=input_data.get("field_key", "resume"),
            field_label_snapshot="Resume",
            doc_type=input_data.get("doc_type", "resume"),
            name=safe_name,
            url=url,
            object_key=object_key,
            mime_type=mime_type,
            size_bytes=len(content),
        )
        if existing:
            document.candidate_id = UUID(candidate_id)
            document.job_id = UUID(input_data["job_id"]) if input_data.get("job_id") else None
            document.name = safe_name
            document.url = url
            document.object_key = object_key
            document.mime_type = mime_type
            document.size_bytes = len(content)
        db.add(document)
        if document.job_id:
            application = (
                (
                    await db.execute(
                        select(JobApplication)
                        .where(
                            JobApplication.org_id == UUID(input_data["org_id"]),
                            JobApplication.candidate_id == UUID(candidate_id),
                            JobApplication.job_id == document.job_id,
                        )
                        .order_by(JobApplication.created_at.desc())
                    )
                )
                .scalars()
                .first()
            )
            if application:
                application.files = {**(application.files or {}), "resume": url}
        await db.commit()
        parse_workflow = await enqueue_job_apply_resume_parse(
            application_id=f"migration-{document.id}-{hashlib.sha256(content).hexdigest()[:16]}",
            input_data=JobApplyResumeParseInput(
                org_id=input_data["org_id"],
                candidate_id=candidate_id,
                object_key=object_key,
                resume_display_name=safe_name,
                mime=mime_type,
                fallback_email=str(input_data.get("fallback_email") or ""),
            ),
        )
        return {
            "document_id": str(document.id),
            "external_document_id": document.external_document_id,
            "object_key": object_key,
            "parse_workflow_id": parse_workflow["workflow_id"],
        }


@activity.defn(name="fetch_candidates")
async def fetch_candidates(input_data: AtsSyncInput) -> list[dict]:
    async with AsyncSessionLocal() as db:
        integration = (
            await db.execute(
                select(AtsIntegration).where(AtsIntegration.id == UUID(input_data.integration_id))
            )
        ).scalar_one()
        if integration.connection_type == "native_mcp":
            encrypted_token = integration.oauth_access_token_encrypted
            if integration.auth_type != "oauth":
                encrypted_token = integration.encrypted_api_key
            if not encrypted_token:
                raise ValueError("MCP integration has no encrypted access token")
            if not settings.encryption_key:
                raise ValueError("Credential encryption is not configured")
            credential = decrypt_value(encrypted_token, settings.encryption_key)
            details = dict(integration.provider_details or {})
            if integration.auth_type == "oauth":
                expires_at_raw = details.get("mcp_token_expires_at")
                expires_at = (
                    datetime.fromisoformat(str(expires_at_raw)) if expires_at_raw else None
                )
                if expires_at is not None and datetime.now(UTC) >= expires_at:
                    if not integration.oauth_refresh_token_encrypted:
                        raise ValueError("MCP OAuth session expired; reconnect the provider")
                    refresh_token = decrypt_value(
                        integration.oauth_refresh_token_encrypted, settings.encryption_key
                    )
                    client_info = dict(details.get("mcp_oauth_client") or {})
                    if integration.encrypted_api_key:
                        client_info["client_secret"] = decrypt_value(
                            integration.encrypted_api_key, settings.encryption_key
                        )
                    refreshed = await refresh_access_token(
                        refresh_token=refresh_token,
                        metadata=dict(details.get("mcp_oauth_metadata") or {}),
                        client_info=client_info,
                    )
                    credential = refreshed.access_token
                    integration.oauth_access_token_encrypted = encrypt_value(
                        credential, settings.encryption_key
                    )
                    if refreshed.refresh_token:
                        integration.oauth_refresh_token_encrypted = encrypt_value(
                            refreshed.refresh_token, settings.encryption_key
                        )
                    details["mcp_token_expires_at"] = token_expiry(refreshed.expires_in)
                    integration.provider_details = details
                    await db.commit()
            access_token, extra_headers = build_mcp_auth(
                integration.provider, credential, details
            )
            endpoint_url = (
                decrypt_value(integration.mcp_endpoint_encrypted, settings.encryption_key)
                if integration.mcp_endpoint_encrypted
                else details.get("mcp_endpoint_url") or integration.base_url
            )
            return await fetch_entity_bundle_from_mcp(
                endpoint_url,
                access_token,
                integration.mcp_tools_cache,
                input_data.since,
                provider=integration.provider,
                tool_mapping=details.get("mcp_tool_mapping"),
                extra_headers=extra_headers,
            )
        registry = load_connector_registry(CONFIG_DIR)
        config = registry.get(integration.provider)
        if integration.provider == "generic":
            # Generic REST integrations store their provider id as `generic`,
            # while the shared defaults live in generic_rest.json.
            config = registry.get("generic_rest")
        if config is None:
            raise ValueError(f"No connector config registered for {integration.provider}")
        if integration.provider == "generic":
            generic = (
                await db.execute(
                    select(GenericAtsConfig).where(
                        GenericAtsConfig.integration_id == integration.id
                    )
                )
            ).scalar_one()
            endpoint_config = generic.endpoint_config or {
                "candidates": {"path": generic.candidates_endpoint_path, "method": "GET"}
            }
            config = type(config).model_validate(
                {
                    **config.model_dump(mode="json"),
                    "base_url": integration.base_url,
                    "auth": {
                        **config.auth.model_dump(mode="json"),
                        "type": integration.auth_type,
                        "header_name": generic.auth_header_name,
                    },
                    "endpoints": endpoint_config,
                    "pagination": {
                        **config.pagination.model_dump(mode="json"),
                        "style": generic.pagination_style,
                        "since_param_name": generic.since_param_name,
                    },
                    "mappings": integration.field_mapping_config,
                }
            )
        secret = None
        if integration.encrypted_api_key:
            if not settings.encryption_key:
                raise ValueError("Credential encryption is not configured")
            secret = decrypt_value(integration.encrypted_api_key, settings.encryption_key)
        secret = await resolve_provider_secret(
            integration.provider,
            secret,
            integration.provider_details,
        )
        since = input_data.since
        configured_entities = {
            "job": "jobs",
            "candidate": "candidates",
            "stage": "stages",
            "application": "applications",
            "resume": "resumes",
            "interview": "interviews",
            "note": "notes",
        }
        bundle: dict[str, list[dict]] = {}
        fetcher = GenericFetcher(
            config.model_copy(update={"base_url": integration.base_url}), secret
        )

        async def fetch_entity(entity: str, endpoint_name: str) -> list[dict]:
            endpoint = config.endpoints[endpoint_name]
            placeholders = [
                field_name
                for _, field_name, _, _ in string.Formatter().parse(endpoint.path)
                if field_name
            ]
            if not placeholders:
                return [record async for record in fetcher.records(endpoint_name, since=since)]

            parent_by_placeholder = {
                "external_job_id": "job",
                "external_candidate_id": "candidate",
            }
            parent_entities = {parent_by_placeholder.get(name) for name in placeholders}
            if None in parent_entities or len(parent_entities) != 1:
                raise ValueError(f"{endpoint_name} endpoint has unsupported path parameters")
            parent_entity = next(iter(parent_entities))
            parent_records = bundle.get(parent_entity, [])
            fetched: list[dict] = []
            for parent in parent_records:
                path_params: dict[str, Any] = {}
                for placeholder in placeholders:
                    parent_path = config.mappings.get(parent_entity, {}).get(placeholder)
                    value = get_path(parent, parent_path)
                    if value is None:
                        continue
                    path_params[placeholder] = value
                if len(path_params) != len(placeholders):
                    continue
                async for record in fetcher.records(
                    endpoint_name, since=since, path_params=path_params
                ):
                    linked = dict(record)
                    link_field = {
                        "external_job_id": "job_id",
                        "external_candidate_id": "candidate_id",
                    }.get(placeholders[0])
                    if link_field and link_field not in linked:
                        linked[link_field] = path_params[placeholders[0]]
                    if entity == "resume":
                        resume_mapping = config.mappings.get("resume", {})
                        source_url = get_path(linked, resume_mapping.get("source_url"))
                        content_base64 = get_path(linked, resume_mapping.get("content_base64"))
                        if not source_url and not content_base64:
                            continue
                    fetched.append(linked)
            return fetched

        # Fetch parents before dependent endpoints such as Greenhouse stages, notes, and resumes.
        for entity in ("job", "candidate", "stage", "application", "resume", "interview", "note"):
            endpoint_name = configured_entities[entity]
            if endpoint_name in config.endpoints:
                if (
                    integration.provider == "bamboohr"
                    and entity == "application"
                    and config.endpoints["applications"].path == config.endpoints["candidates"].path
                ):
                    bundle[entity] = list(bundle.get("candidate", []))
                    continue
                bundle[entity] = await fetch_entity(entity, endpoint_name)
        if "application_stages" in config.endpoints:
            bundle["application_stage"] = await fetch_entity(
                "application_stage", "application_stages"
            )

        async def hydrate_records(
            endpoint_name: str,
            parent_entity: str,
            id_field: str,
            placeholder: str,
        ) -> None:
            if endpoint_name not in config.endpoints:
                return
            hydrated: list[dict[str, Any]] = []
            id_path = config.mappings.get(parent_entity, {}).get(id_field, id_field)
            for summary in bundle.get(parent_entity, []):
                external_id = get_path(summary, id_path)
                if external_id is None:
                    continue
                details = [
                    record
                    async for record in fetcher.records(
                        endpoint_name,
                        path_params={placeholder: external_id},
                    )
                ]
                hydrated.extend([{**summary, **detail} for detail in details])
            if hydrated:
                bundle[parent_entity] = hydrated

        await hydrate_records(
            "candidate_details", "candidate", "external_candidate_id", "external_candidate_id"
        )
        await hydrate_records(
            "application_details",
            "application",
            "external_application_id",
            "external_application_id",
        )
        if integration.provider == "bamboohr" and bundle.get("application"):
            bundle["candidate"] = list(bundle["application"])
        return adapt_provider_bundle(integration.provider, bundle) or {"candidate": []}


@activity.defn(name="validate_and_map_batch")
async def validate_and_map_batch(input_data: dict) -> dict:
    async with AsyncSessionLocal() as db:
        integration = (
            await db.execute(
                select(AtsIntegration).where(
                    AtsIntegration.id == UUID(input_data["integration_id"])
                )
            )
        ).scalar_one()
        connector = load_connector_registry(CONFIG_DIR).get(integration.provider)
        if connector:
            # Preserve custom mappings while backfilling fields added to a connector later.
            stored_mappings = integration.field_mapping_config or {}
            merged_mappings = {
                entity: {
                    **connector.mappings.get(entity, {}),
                    **(
                        stored_mappings.get(entity, {})
                        if isinstance(stored_mappings.get(entity, {}), dict)
                        else {}
                    ),
                }
                for entity in set(connector.mappings) | set(stored_mappings)
            }
            if integration.provider == "workable":
                resume_mapping = merged_mappings.setdefault("resume", {})
                if resume_mapping.get("source_url") == "url":
                    resume_mapping["source_url"] = "resume_url"
                if resume_mapping.get("filename") == "filename":
                    resume_mapping["filename"] = "resume_metadata.filename"
                if resume_mapping.get("mime_type") == "content_type":
                    resume_mapping.pop("mime_type")
            if merged_mappings != stored_mappings:
                integration.field_mapping_config = merged_mappings
                await db.commit()
        integration.status = "connected"
        details = dict(integration.provider_details or {})
        details.pop("last_sync_error", None)
        integration.provider_details = details
        batch = await create_pending_batch(
            db,
            integration,
            input_data["raw_records"],
            input_data.get("source", integration.provider),
        )
        return {"batch_id": str(batch.id), "status": batch.status, "total_rows": batch.total_rows}


@activity.defn(name="mark_ats_sync_failed")
async def mark_ats_sync_failed(input_data: dict) -> None:
    async with AsyncSessionLocal() as db:
        integration = (
            await db.execute(
                select(AtsIntegration).where(
                    AtsIntegration.id == UUID(input_data["integration_id"])
                )
            )
        ).scalar_one_or_none()
        if integration is None:
            return
        integration.status = "error"
        integration.provider_details = {
            **(integration.provider_details or {}),
            "last_sync_error": str(input_data.get("error") or "Sync failed")[:1000],
        }
        await db.commit()


@activity.defn(name="commit_batch")
async def commit_batch_activity(input_data: CommitBatchInput) -> dict:
    async with AsyncSessionLocal() as db:
        try:
            batch = (
                await db.execute(
                    select(ImportBatch)
                    .where(ImportBatch.id == UUID(input_data.batch_id))
                    .with_for_update()
                )
            ).scalar_one()
            # Load relationships explicitly before the transaction uses them.
            await db.refresh(batch, ["integration", "rows"])
            result = await commit_batch(db, batch, UUID(input_data.actor_id))
            resume_rows = [
                row
                for row in batch.rows
                if row.entity_type == "resume" and row.row_status == "valid" and row.mapped_payload
            ]
            for row in resume_rows:
                payload = row.mapped_payload or {}
                candidate = (
                    await db.execute(
                        select(Candidate).where(
                            Candidate.org_id == batch.integration.org_id,
                            Candidate.external_candidate_id
                            == str(payload.get("external_candidate_id")),
                        )
                    )
                ).scalar_one_or_none()
                if not candidate:
                    result["unresolved_errors"] += 1
                    row.result_status = "skipped"
                    row.result_reason = "Imported candidate was not found for resume transfer"
                    continue
                try:
                    transfer = await transfer_resume_attachment(
                        {
                            **payload,
                            "org_id": str(batch.integration.org_id),
                            "candidate_id": str(candidate.id),
                            "job_id": str(candidate.job_id)
                            if candidate.job_id
                            else payload.get("job_id"),
                            "fallback_email": candidate.email,
                        }
                    )
                    row.result_status = "created"
                    row.result_record_id = UUID(transfer["document_id"])
                    row.result_reason = f"Resume transferred to {transfer['object_key']}; parsing and scoring queued"
                    result["resumes_transferred"] = result.get("resumes_transferred", 0) + 1
                except Exception as exc:
                    logger.exception("Resume transfer failed for batch row %s", row.id)
                    row.result_status = "error"
                    row.result_reason = str(exc)
                    result["unresolved_errors"] += 1
            # A notification failure must not turn a successful database import into a failed batch.
            try:
                await send_import_complete_email(batch, result)
            except Exception:
                logger.exception("Import completion notification failed for batch %s", batch.id)
            batch.status = (
                "completed_with_flags" if result.get("unresolved_errors") else "completed"
            )
            await db.commit()
            return {"batch_id": input_data.batch_id, "status": batch.status, **result}
        except Exception as exc:
            await db.rollback()
            failed = (
                await db.execute(
                    select(ImportBatch).where(ImportBatch.id == UUID(input_data.batch_id))
                )
            ).scalar_one_or_none()
            if failed:
                failed.status = "failed"
                failed.error_reason = str(exc)
                db.add(
                    ImportAuditLog(
                        batch_id=failed.id,
                        actor_id=UUID(input_data.actor_id),
                        action="failed",
                        metadata_json={"error": str(exc)},
                    )
                )
                await db.commit()
            raise


@activity.defn(name="send_import_complete_email")
async def send_import_complete_email_activity(input_data: dict) -> dict:
    if not settings.is_production and settings.ses_local_mock:
        logger.info(
            "[LOCAL SES MOCK] import complete batch=%s provider=%s committed=%s excluded=%s",
            input_data.get("batch_id"),
            input_data.get("provider"),
            input_data.get("committed", 0),
            input_data.get("excluded", 0),
        )
        return {"status": "mocked"}
    raise RuntimeError("Real SES delivery is disabled for this local implementation")


async def send_import_complete_email(batch: ImportBatch, result: dict) -> None:
    await send_import_complete_email_activity(
        {"batch_id": str(batch.id), "provider": batch.integration.provider, **result}
    )
