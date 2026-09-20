"""store import row outcomes and batch errors"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op


revision = "20260916_import_result_metadata"
down_revision = "20260909_entity_batch_metadata"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("import_batches", sa.Column("error_reason", sa.Text(), nullable=True))
    op.add_column("import_batch_rows", sa.Column("result_status", sa.String(length=20), nullable=True))
    op.add_column("import_batch_rows", sa.Column("result_record_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("import_batch_rows", sa.Column("result_reason", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("import_batch_rows", "result_reason")
    op.drop_column("import_batch_rows", "result_record_id")
    op.drop_column("import_batch_rows", "result_status")
    op.drop_column("import_batches", "error_reason")
