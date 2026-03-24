"""merge heads

Revision ID: aa1bb2cc3dd4
Revises: x1y2z3a4b5c6, z2a3b4c5d6e7
Create Date: 2026-03-21

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "aa1bb2cc3dd4"
down_revision: Union[str, Sequence[str], None] = ("x1y2z3a4b5c6", "z2a3b4c5d6e7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
