"""user account role (user/admin) and remove super_admin from org memberships

Revision ID: y2z3a4b5c6d7
Revises: x1y2z3a4b5c6
Create Date: 2026-03-23

Adds users.role for product-level user vs admin. Org-level super_admin is removed;
existing rows are migrated to org admin.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "y2z3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "x1y2z3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    user_cols = {col["name"] for col in inspector.get_columns("users")}
    if "role" not in user_cols:
        op.add_column(
            "users",
            sa.Column("role", sa.String(), nullable=False, server_default="user"),
        )
        op.create_check_constraint(
            "ck_users_account_role",
            "users",
            "role IN ('user', 'admin')",
        )
        op.alter_column("users", "role", server_default=None)

    op.execute("UPDATE org_memberships SET role = 'admin' WHERE role = 'super_admin'")

    op.drop_constraint("ck_org_memberships_role", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_role",
        "org_memberships",
        "role IN ("
        "'owner', 'admin', 'recruiter', "
        "'hiring_manager', 'interviewer', 'employee'"
        ")",
    )


def downgrade() -> None:
    op.drop_constraint("ck_org_memberships_role", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_role",
        "org_memberships",
        "role IN ("
        "'owner', 'admin', 'super_admin', 'recruiter', "
        "'hiring_manager', 'interviewer', 'employee'"
        ")",
    )

    bind = op.get_bind()
    inspector = inspect(bind)
    user_cols = {col["name"] for col in inspector.get_columns("users")}
    if "role" in user_cols:
        op.drop_constraint("ck_users_account_role", "users", type_="check")
        op.drop_column("users", "role")
