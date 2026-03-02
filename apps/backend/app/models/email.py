from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Email(Base):
    __tablename__ = "emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    sent_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    direction = Column(String, nullable=False)
    status = Column(String, nullable=False)
    provider_message_id = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("direction IN ('outbound', 'inbound')", name="ck_emails_direction"),
        CheckConstraint("status IN ('queued', 'sent', 'failed')", name="ck_emails_status"),
        Index("ix_emails_candidate_created", "candidate_id", "created_at"),
    )

    organization = relationship("Organization")
    candidate = relationship("Candidate")
    sent_by = relationship("User")


class InboundEmail(Base):
    __tablename__ = "inbound_emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    inbox_address = Column(String(320), nullable=False)
    from_email = Column(String(320), nullable=True)
    from_name = Column(String(255), nullable=True)
    subject = Column(String(1000), nullable=True)
    message_id = Column(String(500), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False)
    raw_storage_key = Column(String(2048), nullable=True)
    email_kind = Column(String(32), nullable=False, server_default="candidate")
    has_resume_attachment = Column(Boolean, nullable=False, server_default="false")
    parsed_candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="SET NULL"),
        nullable=True,
    )
    parse_status = Column(
        Enum("ignored", "processed", "failed", name="inbound_parse_status"),
        nullable=False,
        server_default="ignored",
    )
    parse_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index(
            "ix_inbound_emails_org_inbox_received_at",
            "org_id",
            "inbox_address",
            "received_at",
        ),
        Index("ix_inbound_emails_parsed_candidate_id", "parsed_candidate_id"),
    )

    organization = relationship("Organization")
    parsed_candidate = relationship("Candidate")


class InboundEmailAttachment(Base):
    __tablename__ = "inbound_email_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    inbound_email_id = Column(
        UUID(as_uuid=True), ForeignKey("inbound_emails.id", ondelete="CASCADE"), nullable=False
    )
    filename = Column(String(512), nullable=False)
    content_type = Column(String(255), nullable=False)
    storage_key = Column(String(2048), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_inbound_email_attachments_inbound_email_id", "inbound_email_id"),
        Index("ix_inbound_email_attachments_sha256", "sha256"),
    )

    inbound_email = relationship("InboundEmail")
