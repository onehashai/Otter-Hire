"""fix_auth_provider_server_default

Fix server_default for auth_provider column from 'local' to 'email'.

Revision ID: f1a2b3c4d5e6
Revises: 7dd1693daaaf
Create Date: 2026-04-16 18:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e3f1a2b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "auth_provider",
        server_default=sa.text("'email'"),
        existing_type=sa.String(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "auth_provider",
        server_default=sa.text("'local'"),
        existing_type=sa.String(),
        existing_nullable=False,
    )
