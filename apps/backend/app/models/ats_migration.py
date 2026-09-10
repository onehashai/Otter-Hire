from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class AtsIntegration(Base):
    __tablename__ = "ats_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(80), nullable=False)
    auth_type = Column(String(30), nullable=False, server_default="api_key")
    encrypted_api_key = Column(Text, nullable=True)
    credential_last4 = Column(String(4), nullable=True)
    oauth_access_token_encrypted = Column(Text, nullable=True)
    oauth_refresh_token_encrypted = Column(Text, nullable=True)
    mcp_connection_type = Column(String(32), nullable=True)
    mcp_tools_cache = Column(JSONB, nullable=False, server_default="{}")
    provider_details = Column(JSONB, nullable=False, server_default="{}")
    base_url = Column(String(500), nullable=False)
    field_mapping_config = Column(JSONB, nullable=False, server_default="{}")
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(40), nullable=False, server_default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batches = relationship("ImportBatch", back_populates="integration", cascade="all, delete-orphan")
    generic_config = relationship("GenericAtsConfig", back_populates="integration", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("org_id", "provider", name="uq_ats_integrations_org_provider"),)


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("ats_integrations.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(80), nullable=False)
    status = Column(String(40), nullable=False, server_default="pending_approval", index=True)
    total_rows = Column(Integer, nullable=False, server_default="0")
    valid_rows = Column(Integer, nullable=False, server_default="0")
    flagged_rows = Column(Integer, nullable=False, server_default="0")
    error_rows = Column(Integer, nullable=False, server_default="0")
    entity_counts = Column(JSONB, nullable=False, server_default="{}")
    temporal_workflow_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    integration = relationship("AtsIntegration", back_populates="batches")
    rows = relationship("ImportBatchRow", back_populates="batch", cascade="all, delete-orphan")
    audit_entries = relationship("ImportAuditLog", back_populates="batch", cascade="all, delete-orphan")


class GenericAtsConfig(Base):
    __tablename__ = "generic_ats_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("ats_integrations.id", ondelete="CASCADE"), nullable=False, unique=True)
    display_name = Column(String(160), nullable=False)
    candidates_endpoint_path = Column(String(500), nullable=False)
    auth_header_name = Column(String(120), nullable=False, server_default="Authorization")
    pagination_style = Column(String(20), nullable=False, server_default="page")
    since_param_name = Column(String(120), nullable=True)
    endpoint_config = Column(JSONB, nullable=False, server_default="{}")
    encrypted_client_secret = Column(Text, nullable=True)

    integration = relationship("AtsIntegration", back_populates="generic_config")


class ImportBatchRow(Base):
    __tablename__ = "import_batch_rows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_payload = Column(JSONB, nullable=False)
    mapped_payload = Column(JSONB, nullable=True)
    row_status = Column(String(20), nullable=False)
    entity_type = Column(String(32), nullable=False, server_default="candidate", index=True)
    error_reason = Column(Text, nullable=True)
    matched_candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True)
    row_number = Column(Integer, nullable=False)

    batch = relationship("ImportBatch", back_populates="rows")


class ImportAuditLog(Base):
    __tablename__ = "import_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(40), nullable=False)
    metadata_json = Column("metadata", JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    batch = relationship("ImportBatch", back_populates="audit_entries")
