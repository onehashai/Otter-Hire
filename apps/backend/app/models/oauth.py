from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class OAuthClient(Base):
    __tablename__ = "oauth_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    client_id = Column(String(128), nullable=False, unique=True)
    client_secret_hash = Column(String(64), nullable=True)
    client_name = Column(String(160), nullable=False)
    redirect_uris = Column(JSONB, nullable=False, default=list)
    grant_types = Column(
        JSONB, nullable=False, default=lambda: ["authorization_code", "refresh_token"]
    )
    response_types = Column(JSONB, nullable=False, default=lambda: ["code"])
    scope = Column(String(500), nullable=False, default="mcp:read mcp:write")
    token_endpoint_auth_method = Column(String(30), nullable=False, default="none")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OAuthAuthorizationCode(Base):
    __tablename__ = "oauth_authorization_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    code_hash = Column(String(64), nullable=False, unique=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    redirect_uri = Column(String(2048), nullable=False)
    resource = Column(String(2048), nullable=True)
    scope = Column(String(500), nullable=False)
    code_challenge = Column(String(128), nullable=False)
    code_challenge_method = Column(String(8), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_oauth_codes_client_expiry", "client_id", "expires_at"),)


class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    access_token_hash = Column(String(64), nullable=False, unique=True)
    refresh_token_hash = Column(String(64), nullable=True, unique=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    resource = Column(String(2048), nullable=True)
    scope = Column(String(500), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("ix_oauth_tokens_user_org", "user_id", "organization_id", "revoked"),)
