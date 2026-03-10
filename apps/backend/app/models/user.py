from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    email = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, nullable=True)
    auth_provider = Column(String, nullable=False, server_default="local")
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
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("google_id", name="uq_users_google_id"),
        CheckConstraint(
            "role IN ("
            "'owner', 'admin', 'super_admin', 'recruiter', "
            "'hiring_manager', 'interviewer', 'employee'"
            ")",
            name="ck_users_role",
        ),
        CheckConstraint("status IN ('invited', 'active', 'disabled')", name="ck_users_status"),
        CheckConstraint(
            "auth_provider IN ('local', 'google', 'both')",
            name="ck_users_auth_provider",
        ),
        Index("ix_users_email", "email"),
        Index("ix_users_google_id", "google_id"),
    )

    organization = relationship("Organization")
