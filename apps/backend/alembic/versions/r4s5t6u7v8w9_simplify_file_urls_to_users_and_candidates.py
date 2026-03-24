"""simplify_file_urls_to_users_and_candidates

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-02-25 20:40:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "r4s5t6u7v8w9"
down_revision: Union[str, None] = "q3r4s5t6u7v8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("candidates", sa.Column("doc_url", sa.String(), nullable=True))
    op.drop_column("users", "profile_image_key")
    op.drop_table("candidate_documents")


def downgrade() -> None:
    op.create_table(
        "candidate_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("candidate_id", sa.UUID(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("object_key", sa.String(length=2048), nullable=True),
        sa.Column("doc_type", sa.String(length=50), nullable=False, server_default="attachment"),
        sa.Column("size_label", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True
        ),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_candidate_documents_candidate_created",
        "candidate_documents",
        ["candidate_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_candidate_documents_org_candidate",
        "candidate_documents",
        ["org_id", "candidate_id"],
        unique=False,
    )
    op.add_column("users", sa.Column("profile_image_key", sa.String(), nullable=True))
    op.drop_column("candidates", "doc_url")
    op.drop_column("users", "avatar_url")
