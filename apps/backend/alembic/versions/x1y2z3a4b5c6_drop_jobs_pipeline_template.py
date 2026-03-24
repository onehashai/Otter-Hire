"""drop pipeline_template from jobs

Revision ID: x1y2z3a4b5c6
Revises: f8g9h0i1j2k3
Create Date: 2026-03-21

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "x1y2z3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "f8g9h0i1j2k3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("jobs", "pipeline_template")


def downgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("pipeline_template", sa.String(20), server_default="standard", nullable=True),
    )
