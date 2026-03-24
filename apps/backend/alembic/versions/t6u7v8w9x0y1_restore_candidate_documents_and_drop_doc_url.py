"""restore_candidate_documents_and_drop_doc_url

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-02-26 00:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "t6u7v8w9x0y1"
down_revision: Union[str, None] = "s5t6u7v8w9x0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidate_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("candidate_id", sa.UUID(), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("field_key", sa.String(length=120), nullable=False),
        sa.Column("field_label_snapshot", sa.String(length=255), nullable=True),
        sa.Column("doc_type", sa.String(length=50), nullable=False, server_default="custom_field_attachment"),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("object_key", sa.String(length=2048), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_candidate_documents_org_candidate_created",
        "candidate_documents",
        ["org_id", "candidate_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_candidate_documents_org_job_field",
        "candidate_documents",
        ["org_id", "job_id", "field_key"],
        unique=False,
    )
    op.create_index(
        "ix_candidate_documents_org_uploaded_by",
        "candidate_documents",
        ["org_id", "uploaded_by_user_id"],
        unique=False,
    )
    op.drop_column("candidates", "doc_url")


def downgrade() -> None:
    op.add_column("candidates", sa.Column("doc_url", sa.String(), nullable=True))
    op.drop_index("ix_candidate_documents_org_uploaded_by", table_name="candidate_documents")
    op.drop_index("ix_candidate_documents_org_job_field", table_name="candidate_documents")
    op.drop_index("ix_candidate_documents_org_candidate_created", table_name="candidate_documents")
    op.drop_table("candidate_documents")

