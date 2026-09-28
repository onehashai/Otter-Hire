"""Add organization-scoped individual sender blocks.

Revision ID: 20260928_blocked_emails
Revises: 20260924_avatar_enrichment_state
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260928_blocked_emails"
down_revision = "20260924_avatar_enrichment_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blocked_email_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "email", name="uq_blocked_email_addresses_org_email"),
    )
    op.create_index("ix_blocked_email_addresses_org_id", "blocked_email_addresses", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_blocked_email_addresses_org_id", table_name="blocked_email_addresses")
    op.drop_table("blocked_email_addresses")
