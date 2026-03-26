"""merge remaining heads

Revision ID: p9q8r7s6t5u4
Revises: c8d9e0f1a2b3, h4d5e6f7a8b9
Create Date: 2026-03-13 16:45:00.000000

"""

from typing import Sequence, Union

revision: str = "p9q8r7s6t5u4"
down_revision: Union[str, Sequence[str], None] = (
    "c8d9e0f1a2b3",
    "h4d5e6f7a8b9",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
