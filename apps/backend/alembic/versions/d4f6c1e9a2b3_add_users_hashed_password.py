"""add_users_hashed_password

Revision ID: d4f6c1e9a2b3
Revises: c3a9d4b7e1f2
Create Date: 2026-02-17 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4f6c1e9a2b3"
down_revision: Union[str, None] = "c3a9d4b7e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("hashed_password", sa.String(), nullable=False, server_default=""),
    )
    op.alter_column("users", "hashed_password", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "hashed_password")
