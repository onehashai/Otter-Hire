"""
Single table for all org integrations: config, status, and optional encrypted credentials.

One row per (org_id, integration_type). Replaces the former integrations table;
credentials and non-sensitive data are stored here.
"""

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class IntegrationCredential(Base):
    """
    Per-org integration: config, status, and optional encrypted credentials.

    One row per (org_id, integration_type). Holds config (JSONB), status,
    and optionally encrypted_credentials for integrations that need secrets.
    """

    __tablename__ = "integration_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    integration_type = Column(String(64), nullable=False)
    config = Column(JSONB, nullable=False, server_default="{}")
    status = Column(String(32), nullable=False, server_default="pending")
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_test_error = Column(String(2000), nullable=True)
    encrypted_credentials = Column(String(4096), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organization = relationship("Organization", back_populates="integration_credentials")
