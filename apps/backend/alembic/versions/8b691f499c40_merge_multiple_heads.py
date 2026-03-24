"""merge multiple heads

Revision ID: 8b691f499c40
Revises: aa1bb2cc3dd4, e01e9ffb2e05
Create Date: 2026-03-24 10:56:35.235959

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b691f499c40'
down_revision: Union[str, Sequence[str], None] = ('aa1bb2cc3dd4', 'e01e9ffb2e05')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
