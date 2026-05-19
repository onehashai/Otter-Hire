"""add parse_duration_ms to inbound_emails

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Create Date: 2026-05-18
"""

import sqlalchemy as sa

from alembic import op

revision = "d1e2f3a4b5c6"
down_revision = "c9d8e7f6a5b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inbound_emails",
        sa.Column("parse_duration_ms", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inbound_emails", "parse_duration_ms")
