from sqlalchemy import Boolean, Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Integration(Base):
    """
    Master list of available integrations (Email, LinkedIn, Indeed, etc.)

    This table defines what integrations are available in the system.
    Each organization can connect to these integrations via integration_credentials.

    Email integration stores inbound_address in integration_credentials.config
    """

    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    name = Column(String(100), nullable=False)  # "Email", "LinkedIn", "Indeed"
    slug = Column(String(50), unique=True, nullable=False)  # "email", "linkedin", "indeed"
    category = Column(String(50), nullable=False)  # "email", "job_portal", "calendar"
    description = Column(Text)
    is_active = Column(Boolean, default=True, nullable=False)
    config = Column(JSONB, default={}, nullable=False)  # Integration-specific config
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_integrations_slug", "slug"),
        Index("ix_integrations_category", "category"),
        Index("ix_integrations_is_active", "is_active"),
    )

    credentials = relationship("IntegrationCredential", back_populates="integration")
