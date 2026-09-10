"""add ATS integrations and approval batches"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260909_ats_batches"
down_revision = "20260908_add_api_keys"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ats_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("field_mapping_config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(40), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "provider", name="uq_ats_integrations_org_provider"),
    )
    op.create_index("ix_ats_integrations_org_id", "ats_integrations", ["org_id"])
    op.create_table(
        "import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ats_integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(80), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending_approval"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("flagged_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("temporal_workflow_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_import_batches_integration_id", "import_batches", ["integration_id"])
    op.create_index("ix_import_batches_status", "import_batches", ["status"])
    op.create_table(
        "import_batch_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=False),
        sa.Column("mapped_payload", postgresql.JSONB()),
        sa.Column("row_status", sa.String(20), nullable=False),
        sa.Column("error_reason", sa.Text()),
        sa.Column("matched_candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id", ondelete="SET NULL")),
        sa.Column("row_number", sa.Integer(), nullable=False),
    )
    op.create_index("ix_import_batch_rows_batch_id", "import_batch_rows", ["batch_id"])
    op.create_table(
        "import_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_import_audit_log_batch_id", "import_audit_log", ["batch_id"])


def downgrade():
    op.drop_table("import_audit_log")
    op.drop_table("import_batch_rows")
    op.drop_table("import_batches")
    op.drop_table("ats_integrations")
