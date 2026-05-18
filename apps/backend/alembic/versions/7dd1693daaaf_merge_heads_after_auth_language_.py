"""merge heads after auth/language/password migrations

Revision ID: 7dd1693daaaf
Revises: a1b2c3d4e5f6, d4e5f6a7b8c9
Create Date: 2026-04-15 10:27:31.561202

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "7dd1693daaaf"
down_revision: Union[str, None] = ("a1b2c3d4e5f6", "d4e5f6a7b8c9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
