"""add organization-scoped external API keys"""

from alembic import op
import sqlalchemy as sa

revision = "20260908_add_api_keys"
down_revision = "b7e4a9f1c8f7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "api_keys",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("org_id", sa.UUID(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_api_keys_org_active", "api_keys", ["org_id", "is_active"])


def downgrade():
    op.drop_index("ix_api_keys_org_active", table_name="api_keys")
    op.drop_table("api_keys")
