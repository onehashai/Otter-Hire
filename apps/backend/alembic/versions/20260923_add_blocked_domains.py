"""add organization blocked domains

Revision ID: 20260923_blocked_domains
Revises: 20260921_message_metadata
Create Date: 2026-09-23 10:00:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260923_blocked_domains"
down_revision = "20260921_message_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blocked_domains",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain", sa.String(length=253), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "domain", name="uq_blocked_domains_org_domain"),
    )
    op.create_index("ix_blocked_domains_org_id", "blocked_domains", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_blocked_domains_org_id", table_name="blocked_domains")
    op.drop_table("blocked_domains")
