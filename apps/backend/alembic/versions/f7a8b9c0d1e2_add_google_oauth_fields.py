"""add google oauth fields to users

Revision ID: f7a8b9c0d1e2
Revises: z2a3b4c5d6e7
Create Date: 2026-03-10

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "z2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make hashed_password nullable (Google-only accounts have no password)
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)

    # Add google_id column
    op.add_column("users", sa.Column("google_id", sa.String(), nullable=True))
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])
    op.create_index("ix_users_google_id", "users", ["google_id"])

    # Add auth_provider column with default 'local' for all existing users
    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(),
            nullable=False,
            server_default="local",
        ),
    )
    op.create_check_constraint(
        "ck_users_auth_provider",
        "users",
        "auth_provider IN ('local', 'google', 'both')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_auth_provider", "users", type_="check")
    op.drop_column("users", "auth_provider")
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_column("users", "google_id")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
