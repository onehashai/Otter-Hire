from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class FieldMappingConfig(BaseModel):
    candidate: dict[str, str] = Field(default_factory=dict)
    job: dict[str, str] = Field(default_factory=dict)
    stage: dict[str, str] = Field(default_factory=dict)
    application: dict[str, str] = Field(default_factory=dict)
    resume: dict[str, str] = Field(default_factory=dict)
    interview: dict[str, str] = Field(default_factory=dict)
    note: dict[str, str] = Field(default_factory=dict)


class AtsIntegrationCreate(BaseModel):
    provider: str = Field(min_length=1, max_length=80)
    base_url: str = Field(min_length=1, max_length=500)
    api_key: str | None = None
    field_mapping_config: FieldMappingConfig = Field(default_factory=FieldMappingConfig)
    schedule_minutes: int = Field(default=15, ge=5, le=1440)
    auth_type: Literal["api_key", "bearer", "basic", "oauth2", "none"] = "api_key"
    provider_details: dict[str, Any] = Field(default_factory=dict)


class GenericAtsConfigCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=160)
    base_url: str = Field(min_length=1, max_length=500)
    auth_type: Literal["api_key", "oauth2"] = "api_key"
    api_key: str | None = None
    auth_header_name: str = Field(default="Authorization", min_length=1, max_length=120)
    client_id: str | None = None
    client_secret: str | None = None
    authorize_url: str | None = None
    token_url: str | None = None
    candidates_endpoint_path: str = Field(min_length=1, max_length=500)
    field_mapping_config: FieldMappingConfig = Field(default_factory=FieldMappingConfig)
    pagination_style: Literal["offset", "cursor", "page"] = "page"
    since_param_name: str | None = None


class ProviderSetupRequest(BaseModel):
    provider_details: dict[str, Any] = Field(default_factory=dict)


class McpKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scope: Literal["read_only", "read_write"] = "read_only"


class McpKeyCreated(BaseModel):
    id: UUID
    name: str
    scope: str
    key: str


class McpKeyRead(BaseModel):
    id: UUID
    name: str
    scope: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class AtsIntegrationRead(BaseModel):
    id: UUID
    provider: str
    base_url: str
    status: str
    last_synced_at: datetime | None
    schedule_minutes: int
    auth_type: str
    masked_key_last4: str | None = None
    provider_details: dict[str, Any] = Field(default_factory=dict)
    mcp_connection_type: str | None = None
    mcp_tools: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AtsMcpProviderRead(BaseModel):
    ats_name: str
    mcp_status: Literal["native_ga", "native_beta"]
    mcp_server_url: str | None
    auth_type: Literal["oauth", "api_key", "none_available"]
    last_verified_date: date | None
    notes: str | None
    supported_operations: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AtsMcpConnectRequest(BaseModel):
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None
    endpoint_url: str | None = None
    tool_names: list[str] = Field(default_factory=list)


class BatchRowRead(BaseModel):
    id: UUID
    row_number: int
    row_status: Literal["valid", "duplicate", "error"]
    error_reason: str | None
    mapped_payload: dict[str, Any] | None
    matched_candidate_id: UUID | None
    entity_type: str = "candidate"


class ImportBatchRead(BaseModel):
    id: UUID
    integration_id: UUID
    source: str
    status: str
    total_rows: int
    valid_rows: int
    flagged_rows: int
    error_rows: int
    created_at: datetime
    approved_by: UUID | None
    approved_at: datetime | None
    entity_counts: dict[str, Any] = Field(default_factory=dict)

    model_config = {"from_attributes": True}


class ImportBatchDetail(ImportBatchRead):
    rows: list[BatchRowRead]


class MigrationStartResponse(BaseModel):
    id: UUID
    status: str
    provider: str


class BatchCommitResponse(BaseModel):
    batch_id: UUID
    status: str
    committed: int
    excluded: int
    committed_clean: int = 0
    committed_duplicates: int = 0
    unresolved_errors: int = 0


class BatchRetryRequest(BaseModel):
    entity_type: str | None = Field(default=None, min_length=1, max_length=32)
    row_ids: list[UUID] = Field(default_factory=list)


class BatchPreviewRow(BaseModel):
    row_id: UUID
    row_number: int
    entity_type: str
    current_status: str
    outcome: Literal["created", "updated", "skipped"]
    reason: str | None = None
    matched_record_id: UUID | None = None


class BatchPreviewResponse(BaseModel):
    batch_id: UUID
    batch_status: str
    created: int
    updated: int
    skipped: int
    rows: list[BatchPreviewRow]


class ProviderCapabilityRead(BaseModel):
    provider: str
    display_name: str
    entities: dict[str, bool]
    mapping_template: dict[str, dict[str, str]]


class BatchReportRow(BaseModel):
    row_id: UUID
    row_number: int
    entity_type: str
    final_status: str
    error_reason: str | None = None
    matched_candidate_id: UUID | None = None


class BatchReportResponse(BaseModel):
    batch_id: UUID
    source: str
    status: str
    totals: dict[str, int]
    rows: list[BatchReportRow]
