"""enable verified Ashby MCP migration mapping"""

from datetime import date

import sqlalchemy as sa

from alembic import op

revision = "20260917_ashby_mcp_import"
down_revision = "20260917_mcp_registry_auth"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET last_verified_date = :verified,
                notes = :notes,
                supported_operations = '["read"]'::jsonb
            WHERE ats_name = 'ashby'
            """
        ).bindparams(
            verified=date(2026, 9, 17),
            notes=(
                "OAuth MCP migration supports jobs, applications, candidates, stages, "
                "and downloadable resumes when Ashby exposes the required read tools."
            ),
        )
    )


def downgrade():
    op.execute(
        sa.text(
            """
            UPDATE ats_mcp_registry
            SET notes = :notes
            WHERE ats_name = 'ashby'
            """
        ).bindparams(
            notes=(
                "OAuth connection verified; migration remains disabled because vendor "
                "tool contracts may change without notice."
            )
        )
    )
