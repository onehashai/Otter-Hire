"""add_visibility_column_to_jobs

Revision ID: dd9491b3aa0b
Revises: 8a89e7274288
Create Date: 2026-02-23 04:26:29.908509

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "dd9491b3aa0b"
down_revision: Union[str, None] = "8a89e7274288"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add visibility column with default 'internal'
    op.add_column(
        "jobs", sa.Column("visibility", sa.String(20), server_default="internal", nullable=False)
    )

    # Add check constraint
    op.create_check_constraint("ck_jobs_visibility", "jobs", "visibility IN ('internal', 'public')")

    # Set existing open jobs to public visibility
    op.execute("UPDATE jobs SET visibility = 'public' WHERE status = 'open'")


def downgrade() -> None:
    # Drop constraint and column
    op.drop_constraint("ck_jobs_visibility", "jobs", type_="check")
    op.drop_column("jobs", "visibility")
