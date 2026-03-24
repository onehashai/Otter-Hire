"""add super_admin role

Revision ID: a3b4c5d6e7f8
Revises: z2a3b4c5d6e7
Create Date: 2026-03-02

"""

from typing import Sequence, Union

from alembic import op

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, Sequence[str], None] = "z2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('owner', 'admin', 'super_admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
    )

    op.drop_constraint("ck_org_memberships_role", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_role",
        "org_memberships",
        "role IN ('owner', 'admin', 'super_admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
    )


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")
    op.execute("UPDATE org_memberships SET role = 'admin' WHERE role = 'super_admin'")

    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
    )

    op.drop_constraint("ck_org_memberships_role", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_role",
        "org_memberships",
        "role IN ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
    )
