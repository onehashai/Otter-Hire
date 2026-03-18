"""merge all heads

Revision ID: f8g9h0i1j2k3
Revises: p9q8r7s6t5u4, a1b2c3d4e5f7
Create Date: 2026-03-18

"""
from typing import Sequence, Union

from alembic import op

revision: str = "f8g9h0i1j2k3"
down_revision: Union[str, Sequence[str], None] = (
    "p9q8r7s6t5u4",
    "a1b2c3d4e5f7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
