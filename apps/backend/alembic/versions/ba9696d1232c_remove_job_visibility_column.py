"""remove_job_visibility_column

Revision ID: ba9696d1232c
Revises: g2h3i4j5k6l7
Create Date: 2026-02-20 15:24:07.415853

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ba9696d1232c"
down_revision: Union[str, None] = "g2h3i4j5k6l7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_jobs_visibility", "jobs", type_="check")
    op.drop_column("jobs", "visibility")


def downgrade() -> None:
    op.add_column(
        "jobs", sa.Column("visibility", sa.String(10), server_default="internal", nullable=False)
    )
    op.create_check_constraint(
        "ck_jobs_visibility", "jobs", "visibility IN ('internal', 'careers', 'public')"
    )
