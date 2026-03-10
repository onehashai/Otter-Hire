from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class OrgIntegration(Base):
    """
    Generic credential store for all org integrations (smtp, gmail_oauth, outlook_oauth, etc.).
    One row per (org_id, integration_type).

    - config:                plain JSONB  — non-sensitive settings (host, port, from_email, …)
    - encrypted_credentials: Fernet-encrypted JSON string — passwords, tokens, secrets
    - status:                pending | active | failed
    """

    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    integration_type = Column(String(64), nullable=False)
    config = Column(JSONB, nullable=False, server_default="{}")
    encrypted_credentials = Column(String(4096), nullable=True)
    status = Column(String(32), nullable=False, server_default="pending")
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_test_error = Column(String(2000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organization = relationship("Organization", back_populates="integrations")
