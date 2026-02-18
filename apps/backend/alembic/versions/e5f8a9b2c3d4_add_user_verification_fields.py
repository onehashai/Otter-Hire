"""add_user_verification_fields

Revision ID: e5f8a9b2c3d4
Revises: d4f6c1e9a2b3
Create Date: 2026-02-17 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f8a9b2c3d4"
down_revision: Union[str, None] = "d4f6c1e9a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("verification_token_hash", sa.String(), nullable=True))
    op.add_column("users", sa.Column("verification_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("is_onboarded", sa.Boolean(), nullable=False, server_default="false"))
    op.alter_column("users", "is_verified", server_default=None)
    op.alter_column("users", "is_onboarded", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_onboarded")
    op.drop_column("users", "verification_token_expires_at")
    op.drop_column("users", "verification_token_hash")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "is_verified")
