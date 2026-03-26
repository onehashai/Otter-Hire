"""
Per-org integration credentials and configuration.

One row per (org_id, integration_id). Stores config, status, and optional encrypted credentials.
Each org can connect to integrations defined in the integrations table.
"""

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class IntegrationCredential(Base):
    """
    Per-org integration: config, status, and optional encrypted credentials.

    One row per (org_id, integration_id). Holds config (JSONB), status,
    and optionally encrypted_credentials for integrations that need secrets.

    Examples:
    - Email integration: stores inbound_address in config
    - LinkedIn integration: stores OAuth tokens in encrypted_credentials
    """

    __tablename__ = "integration_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    integration_id = Column(
        UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False, index=True
    )
    config = Column(JSONB, nullable=False, server_default="{}")
    status = Column(String(32), nullable=False, server_default="pending")
    encrypted_credentials = Column(String(4096), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "org_id", "integration_id", name="uq_integration_credentials_org_integration"
        ),
    )

    organization = relationship("Organization", back_populates="integration_credentials")
    integration = relationship("Integration")
