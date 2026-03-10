from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    direction = Column(String(16), nullable=False)
    sender_type = Column(String(16), nullable=False)
    sender_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    from_email = Column(String(320), nullable=False)
    to_email = Column(String(320), nullable=False)
    body = Column(Text, nullable=False)
    html_body = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, server_default="queued")
    provider_message_id = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "direction IN ('inbound', 'outbound')",
            name="ck_messages_direction",
        ),
        CheckConstraint(
            "sender_type IN ('user', 'candidate')",
            name="ck_messages_sender_type",
        ),
        CheckConstraint(
            "status IN ('queued', 'sent', 'failed', 'received')",
            name="ck_messages_status",
        ),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
        Index("ix_messages_org_id", "org_id"),
    )

    conversation = relationship("Conversation", back_populates="messages")
    sender_user = relationship("User")
