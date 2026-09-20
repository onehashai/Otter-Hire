"""separate API, native MCP, and SmartATS bridge connections"""

import sqlalchemy as sa

from alembic import op

revision = "20260918_ats_connection_type"
down_revision = "20260917_ashby_mcp_import"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "ats_integrations",
        sa.Column("connection_type", sa.String(length=32), server_default="api", nullable=False),
    )
    op.execute(
        """
        UPDATE ats_integrations
        SET connection_type = 'native_mcp'
        WHERE mcp_connection_type IS NOT NULL
        """
    )
    op.drop_constraint(
        "uq_ats_integrations_org_provider",
        "ats_integrations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_ats_integrations_org_provider_connection",
        "ats_integrations",
        ["org_id", "provider", "connection_type"],
    )
    op.create_check_constraint(
        "ck_ats_integrations_connection_type",
        "ats_integrations",
        "connection_type IN ('api', 'native_mcp', 'smartats_bridge')",
    )


def downgrade():
    op.drop_constraint(
        "ck_ats_integrations_connection_type",
        "ats_integrations",
        type_="check",
    )
    op.drop_constraint(
        "uq_ats_integrations_org_provider_connection",
        "ats_integrations",
        type_="unique",
    )
    op.execute(
        """
        DELETE FROM ats_integrations newer
        USING ats_integrations older
        WHERE newer.org_id = older.org_id
          AND newer.provider = older.provider
          AND (
            newer.created_at > older.created_at
            OR (newer.created_at = older.created_at AND newer.id > older.id)
          )
        """
    )
    op.create_unique_constraint(
        "uq_ats_integrations_org_provider",
        "ats_integrations",
        ["org_id", "provider"],
    )
    op.drop_column("ats_integrations", "connection_type")
