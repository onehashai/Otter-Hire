"""Add OAuth clients, authorization codes, and bearer tokens.

Revision ID: 20260928_oauth_auth
Revises: 20260928_blocked_emails
"""

import sqlalchemy as sa

from alembic import op

revision = "20260928_oauth_auth"
down_revision = "20260928_blocked_emails"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS is intentional: the unified baseline creates the current ORM
    # metadata, which can already include tables introduced by later revisions.
    op.execute(
        sa.text("""
        CREATE TABLE IF NOT EXISTS oauth_clients (
            id UUID PRIMARY KEY NOT NULL,
            client_id VARCHAR(128) NOT NULL UNIQUE,
            client_secret_hash VARCHAR(64),
            client_name VARCHAR(160) NOT NULL,
            redirect_uris JSONB NOT NULL,
            grant_types JSONB NOT NULL,
            response_types JSONB NOT NULL,
            scope VARCHAR(500) NOT NULL,
            token_endpoint_auth_method VARCHAR(30) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    )
    op.execute(
        sa.text("""
        CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
            id UUID PRIMARY KEY NOT NULL,
            code_hash VARCHAR(64) NOT NULL UNIQUE,
            client_id VARCHAR(128) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            redirect_uri VARCHAR(2048) NOT NULL,
            resource VARCHAR(2048),
            scope VARCHAR(500) NOT NULL,
            code_challenge VARCHAR(128) NOT NULL,
            code_challenge_method VARCHAR(8) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            is_used BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    )
    op.execute(
        sa.text("""
        CREATE TABLE IF NOT EXISTS oauth_tokens (
            id UUID PRIMARY KEY NOT NULL,
            access_token_hash VARCHAR(64) NOT NULL UNIQUE,
            refresh_token_hash VARCHAR(64) UNIQUE,
            client_id VARCHAR(128) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            resource VARCHAR(2048),
            scope VARCHAR(500) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            refresh_expires_at TIMESTAMPTZ,
            revoked BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_oauth_codes_client_expiry "
            "ON oauth_authorization_codes (client_id, expires_at)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_oauth_tokens_user_org "
            "ON oauth_tokens (user_id, organization_id, revoked)"
        )
    )


def downgrade() -> None:
    # Keep OAuth tables and issued credentials intact on downgrade. In this repo,
    # the unified baseline may have created these tables before this revision ran.
    pass
