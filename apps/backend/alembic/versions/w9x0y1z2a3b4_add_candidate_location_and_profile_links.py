"""add_candidate_location_and_profile_links

Revision ID: w9x0y1z2a3b4
Revises: v8w9x0y1z2a3
Create Date: 2026-02-26 00:00:02.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "w9x0y1z2a3b4"
down_revision: Union[str, None] = "v8w9x0y1z2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    with op.batch_alter_table("candidates") as batch_op:
        if "location" not in column_names:
            batch_op.add_column(sa.Column("location", sa.String(), nullable=True))
        if "profile_links" not in column_names:
            batch_op.add_column(sa.Column("profile_links", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    with op.batch_alter_table("candidates") as batch_op:
        if "profile_links" in column_names:
            batch_op.drop_column("profile_links")
        if "location" in column_names:
            batch_op.drop_column("location")

