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
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    # oauth_credentials stores provider-specific identity data as JSONB.
    # Google example: {"provider": "google", "google_id_hash": "<64-char HMAC-SHA256 hex>"}
    # The google_id_hash is HMAC-SHA256(google_sub, ENCRYPTION_KEY) — deterministic, non-reversible.
    # Uniqueness on the hash is enforced via a partial functional index (see migration).
    oauth_credentials = Column(JSONB, nullable=True)
    auth_provider = Column(String, nullable=False, default="email", server_default="email")
    name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_token_hash = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    invite_token_hash = Column(String, nullable=True)
    invite_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    refresh_token_hash = Column(String, nullable=True)
    refresh_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_token_hash = Column(String, nullable=True)
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_onboarded = Column(Boolean, nullable=False, default=False)
    avatar_url = Column(String, nullable=True)
    role = Column(String, nullable=False, server_default="user")
    preferences = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint("status IN ('pending', 'active', 'declined')", name="ck_users_status"),
        CheckConstraint(
            "auth_provider IN ('email', 'google', 'email,google', 'google,email')",
            name="ck_users_auth_provider",
        ),
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_account_role"),
        Index("ix_users_email", "email"),
        # Uniqueness on google_id_hash inside oauth_credentials JSONB is enforced by a
        # partial functional index created in the migration (not expressible in SQLAlchemy ORM).
    )

    organization = relationship("Organization")
    memberships = relationship("OrgMembership", back_populates="user")
