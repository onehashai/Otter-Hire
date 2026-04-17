"""add attachments to messages

Revision ID: e3f1a2b4c5d6
Revises: 7dd1693daaaf
Create Date: 2026-04-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e3f1a2b4c5d6'
down_revision: Union[str, None] = '7dd1693daaaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'messages',
        sa.Column('attachments', JSONB, nullable=False, server_default='[]'),
    )


def downgrade() -> None:
    op.drop_column('messages', 'attachments')
