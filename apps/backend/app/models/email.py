from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, Text
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
