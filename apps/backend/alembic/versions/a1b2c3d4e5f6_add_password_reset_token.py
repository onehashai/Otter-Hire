"""add_password_reset_token

Add password_reset_token_hash and password_reset_token_expires_at to users table.

Revision ID: a1b2c3d4e5f6
Revises: c238d064fe75
Create Date: 2026-04-15 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c238d064fe75"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    has_hash = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_token_hash'")
    ).scalar()
    if not has_hash:
        op.add_column("users", sa.Column("password_reset_token_hash", sa.String(), nullable=True))
    
    has_exp = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_reset_token_expires_at'")
    ).scalar()
    if not has_exp:
        op.add_column(
            "users",
            sa.Column("password_reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "password_reset_token_expires_at")
    op.drop_column("users", "password_reset_token_hash")
