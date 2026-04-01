from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class InboundEmail(Base):
    __tablename__ = "inbound_emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    inbox_address = Column(String(320), nullable=False)
    from_email = Column(String(320), nullable=True)
    from_name = Column(String(255), nullable=True)
    subject = Column(String(1000), nullable=True)
    message_id = Column(String(500), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False)
    raw_storage_key = Column(String(2048), nullable=True)
    attachment_count = Column(BigInteger, nullable=False, server_default="0")
    attachment_primary_storage_key = Column(String(2048), nullable=True)
    attachment_primary_sha256 = Column(String(64), nullable=True)
    attachment_primary_filename = Column(String(512), nullable=True)
    attachment_primary_content_type = Column(String(255), nullable=True)
    attachment_primary_size_bytes = Column(BigInteger, nullable=True)
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
        Index("ix_inbound_emails_job_id", "job_id"),
    )

    organization = relationship("Organization", foreign_keys=[org_id])
    parsed_candidate = relationship("Candidate")


