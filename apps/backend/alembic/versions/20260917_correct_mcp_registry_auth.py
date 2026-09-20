"""correct MCP provider authentication metadata"""

from datetime import date

import sqlalchemy as sa

from alembic import op

revision = "20260917_mcp_registry_auth"
down_revision = "20260916_import_result_metadata"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "ats_integrations",
        sa.Column("mcp_endpoint_encrypted", sa.Text(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET auth_type = 'api_key',
                last_verified_date = :verified,
                notes = :notes
            WHERE ats_name = 'pinpoint'
            """
        ).bindparams(
            verified=date(2026, 9, 17),
            notes=(
                "First-party MCP server. Live API calls require X-API-KEY and "
                "X-Original-Host headers; tool discovery is public."
            ),
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET last_verified_date = :verified,
                supported_operations = '["read"]'::jsonb
            WHERE ats_name IN ('workable', 'greenhouse', 'ashby', 'ninehire', 'zoho_recruit')
            """
        ).bindparams(verified=date(2026, 9, 17))
    )
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET notes = CASE ats_name
                WHEN 'workable' THEN 'OAuth MCP import supports accounts, jobs, stages, candidates, and resumes.'
                WHEN 'greenhouse' THEN 'OAuth MCP import uses administrator-approved read scopes; open beta.'
                WHEN 'ashby' THEN 'OAuth connection verified; migration remains disabled because vendor tool contracts may change without notice.'
                WHEN 'pinpoint' THEN 'MCP connection verified; migration requires a provider-specific JSON:API mapping.'
                WHEN 'ninehire' THEN 'Enterprise workspace MCP key required; migration requires a provider-specific mapping.'
                WHEN 'zoho_recruit' THEN 'Customer-generated MCP endpoint and selected Recruit tools required; migration mapping is not yet enabled.'
                ELSE notes
            END
            WHERE ats_name IN ('workable', 'greenhouse', 'ashby', 'pinpoint', 'ninehire', 'zoho_recruit')
            """
        )
    )


def downgrade():
    op.drop_column("ats_integrations", "mcp_endpoint_encrypted")
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET auth_type = 'oauth'
            WHERE ats_name = 'pinpoint'
            """
        )
    )
