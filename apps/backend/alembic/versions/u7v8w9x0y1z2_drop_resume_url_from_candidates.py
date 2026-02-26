"""drop_resume_url_from_candidates

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-02-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "u7v8w9x0y1z2"
down_revision: Union[str, None] = "t6u7v8w9x0y1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "resume_url" in column_names:
        with op.batch_alter_table("candidates") as batch_op:
            batch_op.drop_column("resume_url")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "resume_url" not in column_names:
        with op.batch_alter_table("candidates") as batch_op:
            batch_op.add_column(sa.Column("resume_url", sa.String(), nullable=True))
