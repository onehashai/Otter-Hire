"""add required flag to stages

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-02-23 18:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l7m8n9o0p1q2"
down_revision: Union[str, None] = "k6l7m8n9o0p1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stages",
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute(
        sa.text(
            """
            UPDATE stages
            SET is_required = true
            WHERE name IN ('Applied', 'Hired')
            """
        )
    )


def downgrade() -> None:
    op.drop_column("stages", "is_required")
