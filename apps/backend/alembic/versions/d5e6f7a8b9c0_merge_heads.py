"""merge heads

Revision ID: d5e6f7a8b9c0
Revises: a3b4c5d6e7f8, c4d5e6f7a8b9
Create Date: 2026-03-10

"""

from typing import Sequence, Union

revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = ("a3b4c5d6e7f8", "c4d5e6f7a8b9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
