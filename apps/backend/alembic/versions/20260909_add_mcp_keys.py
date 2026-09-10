"""add dedicated scoped MCP keys and tool audit support"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260909_mcp_keys"
down_revision = "20260909_provider_cfg"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("import_audit_log", "batch_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_table(
        "mcp_api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("key_prefix", sa.String(16), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_mcp_api_keys_org_active", "mcp_api_keys", ["org_id", "is_active"])


def downgrade():
    op.drop_table("mcp_api_keys")
    op.alter_column("import_audit_log", "batch_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
