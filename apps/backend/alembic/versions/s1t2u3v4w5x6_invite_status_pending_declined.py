"""rename invite statuses to pending/declined

Revision ID: s1t2u3v4w5x6
Revises: r7s8t9u0v1w2
Create Date: 2026-03-27 18:30:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "s1t2u3v4w5x6"
down_revision: Union[str, Sequence[str], None] = "r7s8t9u0v1w2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_org_memberships_status", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_status",
        "org_memberships",
        "status IN ('invited', 'pending', 'active', 'disabled', 'declined')",
    )
    op.drop_constraint("ck_users_status", "users", type_="check")
    op.create_check_constraint(
        "ck_users_status",
        "users",
        "status IN ('invited', 'pending', 'active', 'disabled', 'declined')",
    )

    op.execute("UPDATE org_memberships SET status = 'pending' WHERE status = 'invited'")
    op.execute("UPDATE org_memberships SET status = 'declined' WHERE status = 'disabled'")
    op.execute("UPDATE users SET status = 'pending' WHERE status = 'invited'")
    op.execute("UPDATE users SET status = 'declined' WHERE status = 'disabled'")

    op.drop_constraint("ck_org_memberships_status", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_status",
        "org_memberships",
        "status IN ('pending', 'active', 'declined')",
    )

    op.drop_constraint("ck_users_status", "users", type_="check")
    op.create_check_constraint(
        "ck_users_status",
        "users",
        "status IN ('pending', 'active', 'declined')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_org_memberships_status", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_status",
        "org_memberships",
        "status IN ('invited', 'pending', 'active', 'disabled', 'declined')",
    )
    op.drop_constraint("ck_users_status", "users", type_="check")
    op.create_check_constraint(
        "ck_users_status",
        "users",
        "status IN ('invited', 'pending', 'active', 'disabled', 'declined')",
    )

    op.execute("UPDATE org_memberships SET status = 'invited' WHERE status = 'pending'")
    op.execute("UPDATE org_memberships SET status = 'disabled' WHERE status = 'declined'")
    op.execute("UPDATE users SET status = 'invited' WHERE status = 'pending'")
    op.execute("UPDATE users SET status = 'disabled' WHERE status = 'declined'")

    op.drop_constraint("ck_org_memberships_status", "org_memberships", type_="check")
    op.create_check_constraint(
        "ck_org_memberships_status",
        "org_memberships",
        "status IN ('invited', 'active', 'disabled')",
    )

    op.drop_constraint("ck_users_status", "users", type_="check")
    op.create_check_constraint(
        "ck_users_status",
        "users",
        "status IN ('invited', 'active', 'disabled')",
    )
