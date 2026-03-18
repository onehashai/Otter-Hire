from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    name = Column(String, nullable=False)
    website = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    inbox = relationship("OrgInbox", back_populates="organization", uselist=False)
    integration_credentials = relationship(
        "IntegrationCredential", back_populates="organization", cascade="all, delete-orphan"
    )


class OrgInbox(Base):
    __tablename__ = "org_inboxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True
    )
    inbox_address = Column(String(320), nullable=False, unique=True)
    provider = Column(String(32), nullable=False, server_default="ses")
    status = Column(
        Enum("inactive", "pending", "active", name="org_inbox_status"),
        nullable=False,
        server_default="inactive",
    )
    secret_hash = Column(String(128), nullable=True)
    verification_token_hash = Column(String(128), nullable=True)
    verification_expires_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_status = Column(String(32), nullable=False, server_default="pending")
    verification_provider = Column(String(32), nullable=True)
    verification_email_id = Column(
        UUID(as_uuid=True), ForeignKey("inbound_emails.id", ondelete="SET NULL"), nullable=True
    )
    verification_action_type = Column(String(32), nullable=True)
    verification_action_payload = Column(JSONB, nullable=True)
    verification_detected_at = Column(DateTime(timezone=True), nullable=True)
    verification_error = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organization = relationship("Organization", back_populates="inbox")
