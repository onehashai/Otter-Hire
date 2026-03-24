"""add_org_memberships_and_global_user_identity

Revision ID: m9n0o1p2q3r4
Revises: k6l7m8n9o0p1
Create Date: 2026-02-24 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m9n0o1p2q3r4"
down_revision: Union[str, None] = "k6l7m8n9o0p1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_memberships",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("invite_token_hash", sa.String(), nullable=True),
        sa.Column("invite_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True
        ),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'recruiter', 'hiring_manager', 'interviewer', 'employee')",
            name="ck_org_memberships_role",
        ),
        sa.CheckConstraint(
            "status IN ('invited', 'active', 'disabled')",
            name="ck_org_memberships_status",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "org_id", name="uq_org_memberships_user_org"),
    )
    op.create_index(
        "ix_org_memberships_org_user", "org_memberships", ["org_id", "user_id"], unique=False
    )
    op.create_index(
        "ix_org_memberships_user_status", "org_memberships", ["user_id", "status"], unique=False
    )

    op.execute(
        """
        INSERT INTO org_memberships (id, user_id, org_id, role, status, invite_token_hash, invite_token_expires_at)
        SELECT id, id, org_id, role, status, invite_token_hash, invite_token_expires_at
        FROM users
        WHERE org_id IS NOT NULL
        """
    )

    op.drop_constraint("uq_users_org_email", "users", type_="unique")
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.drop_index("ix_users_org_email", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.alter_column("users", "org_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "org_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_users_email", table_name="users")
    op.create_index("ix_users_org_email", "users", ["org_id", "email"], unique=False)
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.create_unique_constraint("uq_users_org_email", "users", ["org_id", "email"])

    op.drop_index("ix_org_memberships_user_status", table_name="org_memberships")
    op.drop_index("ix_org_memberships_org_user", table_name="org_memberships")
    op.drop_table("org_memberships")
