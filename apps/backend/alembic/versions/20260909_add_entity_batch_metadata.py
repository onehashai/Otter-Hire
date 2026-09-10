"""add entity metadata to migration batches"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260909_entity_batch_metadata"
down_revision = "20260909_external_ats_ids"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("import_batches", sa.Column("entity_counts", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"))
    op.add_column("import_batch_rows", sa.Column("entity_type", sa.String(length=32), nullable=False, server_default="candidate"))
    op.create_index("ix_import_batch_rows_entity_type", "import_batch_rows", ["entity_type"])


def downgrade():
    op.drop_index("ix_import_batch_rows_entity_type", table_name="import_batch_rows")
    op.drop_column("import_batch_rows", "entity_type")
    op.drop_column("import_batches", "entity_counts")
