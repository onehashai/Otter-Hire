"""rename candidate location column to address

Revision ID: a9b8c7d6e5f0
Revises: r7s8t9u0v1w2
Create Date: 2026-03-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "a9b8c7d6e5f0"
down_revision: Union[str, None] = "r7s8t9u0v1w2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "location" in column_names and "address" not in column_names:
        op.execute(sa.text("ALTER TABLE candidates RENAME COLUMN location TO address"))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "address" in column_names and "location" not in column_names:
        op.execute(sa.text("ALTER TABLE candidates RENAME COLUMN address TO location"))
