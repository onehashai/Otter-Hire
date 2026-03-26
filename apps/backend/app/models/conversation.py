from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    subject = Column(String(1000), nullable=False)
    channel = Column(String(32), nullable=False, server_default="email")
    status = Column(String(32), nullable=False, server_default="open")
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "channel IN ('email')",
            name="ck_conversations_channel",
        ),
        CheckConstraint(
            "status IN ('open', 'closed', 'archived')",
            name="ck_conversations_status",
        ),
        UniqueConstraint("org_id", "candidate_id", name="uq_conversations_org_candidate"),
        Index("ix_conversations_org_last_message_at", "org_id", "last_message_at"),
    )

    organization = relationship("Organization")
    candidate = relationship("Candidate")
    job = relationship("Job")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")
