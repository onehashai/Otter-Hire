"""add category to email_templates

Revision ID: f2b3c4d5e6f7
Revises: e6f7a8b9c0d1
Create Date: 2026-03-11

Adds category column to email_templates (default 'Email') for filtering.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f2b3c4d5e6f7"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_templates",
        sa.Column("category", sa.String(), nullable=False, server_default="Email"),
    )


def downgrade() -> None:
    op.drop_column("email_templates", "category")
