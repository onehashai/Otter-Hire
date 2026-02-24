"""rename_department_to_category

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-02-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename department column to category
    op.alter_column('jobs', 'department', new_column_name='category')


def downgrade() -> None:
    # Revert category back to department
    op.alter_column('jobs', 'category', new_column_name='department')
