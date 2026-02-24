from sqlalchemy import Column, String, DateTime, ForeignKey, Index, UniqueConstraint, CheckConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.utils.uuid import uuid7
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    email = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_token_hash = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    invite_token_hash = Column(String, nullable=True)
    invite_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_onboarded = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint("role IN ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')", name="ck_users_role"),
        CheckConstraint("status IN ('invited', 'active', 'disabled')", name="ck_users_status"),
        Index("ix_users_email", "email"),
    )

    organization = relationship("Organization")
