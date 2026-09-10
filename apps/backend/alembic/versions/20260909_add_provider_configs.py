"""add provider credentials and generic ATS configuration"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260909_provider_cfg"
down_revision = "20260909_ats_batches"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ats_integrations", sa.Column("auth_type", sa.String(30), nullable=False, server_default="api_key"))
    op.add_column("ats_integrations", sa.Column("credential_last4", sa.String(4)))
    op.add_column("ats_integrations", sa.Column("oauth_access_token_encrypted", sa.Text()))
    op.add_column("ats_integrations", sa.Column("oauth_refresh_token_encrypted", sa.Text()))
    op.add_column("ats_integrations", sa.Column("provider_details", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.create_table(
        "generic_ats_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ats_integrations.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("candidates_endpoint_path", sa.String(500), nullable=False),
        sa.Column("auth_header_name", sa.String(120), nullable=False, server_default="Authorization"),
        sa.Column("pagination_style", sa.String(20), nullable=False, server_default="page"),
        sa.Column("since_param_name", sa.String(120)),
        sa.Column("endpoint_config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("encrypted_client_secret", sa.Text()),
    )


def downgrade():
    op.drop_table("generic_ats_configs")
    for column in ("provider_details", "oauth_refresh_token_encrypted", "oauth_access_token_encrypted", "credential_last4", "auth_type"):
        op.drop_column("ats_integrations", column)
