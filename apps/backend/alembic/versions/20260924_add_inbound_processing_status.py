"""add processing status for inbound email logs

Revision ID: 20260924_inbound_processing
Revises: 20260923_blocked_domains
Create Date: 2026-09-24 09:15:00.000000
"""

from alembic import op


revision = "20260924_inbound_processing"
down_revision = "20260923_blocked_domains"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum values cannot be removed safely. Adding the state is
    # backward-compatible with existing ignored/processed/failed email logs.
    op.execute("ALTER TYPE inbound_parse_status ADD VALUE IF NOT EXISTS 'processing'")


def downgrade() -> None:
    # PostgreSQL does not support dropping an enum value without recreating the
    # type, which would be destructive for existing email logs.
    pass
