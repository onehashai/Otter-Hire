"""seed the verified ATS MCP provider registry"""

from datetime import date

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260909_seed_more_ats_mcp"
down_revision = "20260909_ats_mcp_client"
branch_labels = None
depends_on = None


def upgrade():
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
    op.bulk_insert(registry, [
        {"id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e103", "ats_name": "greenhouse", "mcp_status": "native_beta", "mcp_server_url": "https://mcp.greenhouse.io/mcp", "auth_type": "oauth", "last_verified_date": date(2026, 9, 9), "notes": "Open beta for Core, Plus, and Pro tiers; Site Admin controls scopes and access.", "supported_operations": ["read", "write"]},
        {"id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e104", "ats_name": "ashby", "mcp_status": "native_beta", "mcp_server_url": "https://mcp.ashbyhq.com/mcp/v1", "auth_type": "oauth", "last_verified_date": date(2026, 9, 9), "notes": "Open beta; user-level OAuth and permissions; supports candidate reads and selected write actions.", "supported_operations": ["read", "write"]},
        {"id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e105", "ats_name": "pinpoint", "mcp_status": "native_ga", "mcp_server_url": "https://developers.pinpointhq.com/mcp", "auth_type": "oauth", "last_verified_date": date(2026, 9, 9), "notes": "First-party V2 MCP with one-click OAuth and action-oriented tools; availability may depend on account access.", "supported_operations": ["read", "write"]},
        {"id": "01991c80-4e4a-7b4e-8a3c-0f4f74f8e106", "ats_name": "ninehire", "mcp_status": "native_ga", "mcp_server_url": "https://api.ninehire.com/developer/mcp", "auth_type": "api_key", "last_verified_date": date(2026, 9, 9), "notes": "Enterprise feature; workspace MCP key uses Bearer authentication and supports read/action workflows.", "supported_operations": ["read", "write"]},
    ])


def downgrade():
    op.execute(sa.text("DELETE FROM ats_mcp_registry WHERE ats_name IN ('greenhouse', 'ashby', 'pinpoint', 'ninehire')"))
