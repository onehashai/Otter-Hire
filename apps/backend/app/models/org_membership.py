from sqlalchemy import Column, String, DateTime, ForeignKey, Index, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.utils.uuid import uuid7
from app.db.base import Base


class OrgMembership(Base):
    __tablename__ = "org_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)
    invite_token_hash = Column(String, nullable=True)
    invite_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_org_memberships_user_org"),
        CheckConstraint("role IN ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')", name="ck_org_memberships_role"),
        CheckConstraint("status IN ('invited', 'active', 'disabled')", name="ck_org_memberships_status"),
        Index("ix_org_memberships_org_user", "org_id", "user_id"),
        Index("ix_org_memberships_user_status", "user_id", "status"),
    )
