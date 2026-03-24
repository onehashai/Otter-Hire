"""merge heads

Revision ID: j5k6l7m8n9o0
Revises: dd9491b3aa0b, i4j5k6l7m8n9
Create Date: 2025-01-10 12:30:00.000000

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'j5k6l7m8n9o0'
down_revision: Union[str, Sequence[str], None] = ('dd9491b3aa0b', 'i4j5k6l7m8n9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
