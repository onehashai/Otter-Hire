"""merge parse_resume and invite_status migration heads

Revision ID: d7e8f9a0b1c2
Revises: n2o3p4q5r6s7, s1t2u3v4w5x6
Create Date: 2026-03-27

"""

from typing import Sequence, Union

revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = (
    "n2o3p4q5r6s7",
    "s1t2u3v4w5x6",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
