"""add vendor MCP registry and connection metadata"""

from datetime import date

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260909_ats_mcp_client"
down_revision = "20260909_mcp_keys"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ats_integrations", sa.Column("mcp_connection_type", sa.String(32), nullable=True))
    op.add_column("ats_integrations", sa.Column("mcp_tools_cache", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"))
    op.create_table(
        "ats_mcp_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("ats_name", sa.String(80), nullable=False, unique=True),
        sa.Column("mcp_status", sa.String(32), nullable=False),
        sa.Column("mcp_server_url", sa.String(500), nullable=True),
        sa.Column("auth_type", sa.String(32), nullable=False, server_default="none_available"),
        sa.Column("last_verified_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("supported_operations", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ats_mcp_registry_ats_name", "ats_mcp_registry", ["ats_name"])
    op.create_index("ix_ats_mcp_registry_mcp_status", "ats_mcp_registry", ["mcp_status"])
    registry = sa.table(
        "ats_mcp_registry",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("ats_name", sa.String),
        sa.column("mcp_status", sa.String),
        sa.column("mcp_server_url", sa.String),
        sa.column("auth_type", sa.String),
        sa.column("last_verified_date", sa.Date),
        sa.column("notes", sa.Text),
        sa.column("supported_operations", postgresql.JSONB),
    )
    # Only vendor documentation confirmed as current is seeded. Unverified vendors
    # remain absent and therefore cannot appear in the Connect via MCP UI.
    op.bulk_insert(registry, [
        {
            "id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e101",
            "ats_name": "workable",
            "mcp_status": "native_ga",
            "mcp_server_url": "https://mcp.workable.com/mcp",
            "auth_type": "oauth",
            "last_verified_date": date(2026, 9, 9),
            "notes": "Vendor documentation describes a live OAuth MCP server. Actions respect Workable permissions.",
            "supported_operations": ["read", "write"],
        },
        {
            "id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e102",
            "ats_name": "zoho_recruit",
            "mcp_status": "native_ga",
            "mcp_server_url": None,
            "auth_type": "oauth",
            "last_verified_date": date(2026, 9, 9),
            "notes": "Zoho Recruit documentation describes OAuth MCP integration; endpoint is created in the customer's Zoho MCP console.",
            "supported_operations": ["read", "write"],
        },
    ])


def downgrade():
    op.drop_index("ix_ats_mcp_registry_mcp_status", table_name="ats_mcp_registry")
    op.drop_index("ix_ats_mcp_registry_ats_name", table_name="ats_mcp_registry")
    op.drop_table("ats_mcp_registry")
    op.drop_column("ats_integrations", "mcp_tools_cache")
    op.drop_column("ats_integrations", "mcp_connection_type")
