from sqlalchemy import Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class BlockedEmailAddress(Base):
    __tablename__ = "blocked_email_addresses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email = Column(String(320), nullable=False)
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "email", name="uq_blocked_email_addresses_org_email"),
        Index("ix_blocked_email_addresses_org_id", "org_id"),
    )
