"""drop users role column

Revision ID: a1b2c3d4e5f7
Revises: b0c1d2e3f4a5
Create Date: 2026-03-18 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "b0c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("users")}
    if "role" in column_names:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_constraint("ck_users_role", type_="check")
            batch_op.drop_column("role")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(), nullable=False, server_default="employee"),
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('owner', 'admin', 'super_admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
    )
    op.alter_column("users", "role", server_default=None)
