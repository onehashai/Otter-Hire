"""make_candidate_job_optional

Revision ID: v8w9x0y1z2a3
Revises: u7v8w9x0y1z2
Create Date: 2026-02-26 00:00:01.000000
"""

from typing import Sequence, Union

from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v8w9x0y1z2a3"
down_revision: Union[str, None] = "u7v8w9x0y1z2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("candidates") as batch_op:
        batch_op.alter_column("job_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    with op.batch_alter_table("candidate_documents") as batch_op:
        batch_op.alter_column("job_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("candidate_documents") as batch_op:
        batch_op.alter_column("job_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

    with op.batch_alter_table("candidates") as batch_op:
        batch_op.alter_column("job_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
