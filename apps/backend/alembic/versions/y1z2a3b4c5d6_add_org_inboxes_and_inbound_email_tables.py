"""add org inboxes and inbound email ingestion tables

Revision ID: y1z2a3b4c5d6
Revises: x0y1z2a3b4c5, l7m8n9o0p1q2
Create Date: 2026-02-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "y1z2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = ("x0y1z2a3b4c5", "l7m8n9o0p1q2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


parse_status_enum = sa.Enum("ignored", "processed", "failed", name="inbound_parse_status")
inbox_status_enum = sa.Enum("inactive", "pending", "active", name="org_inbox_status")


def upgrade() -> None:
    op.create_table(
        "org_inboxes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inbox_address", sa.String(length=320), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="ses"),
        sa.Column("status", inbox_status_enum, nullable=False, server_default="inactive"),
        sa.Column("secret_hash", sa.String(length=128), nullable=True),
        sa.Column("verification_token_hash", sa.String(length=128), nullable=True),
        sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", name="uq_org_inboxes_org_id"),
        sa.UniqueConstraint("inbox_address", name="uq_org_inboxes_inbox_address"),
    )

    op.create_table(
        "inbound_emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inbox_address", sa.String(length=320), nullable=False),
        sa.Column("from_email", sa.String(length=320), nullable=True),
        sa.Column("from_name", sa.String(length=255), nullable=True),
        sa.Column("subject", sa.String(length=1000), nullable=True),
        sa.Column("message_id", sa.String(length=500), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_storage_key", sa.String(length=2048), nullable=True),
        sa.Column("has_resume_attachment", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("parsed_candidate_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parse_status", parse_status_enum, nullable=False, server_default="ignored"),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parsed_candidate_id"], ["candidates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "inbound_email_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inbound_email_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=2048), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["inbound_email_id"], ["inbound_emails.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_inbound_emails_org_inbox_received_at",
        "inbound_emails",
        ["org_id", "inbox_address", "received_at"],
    )
    op.create_index(
        "ix_inbound_emails_org_message_id_not_null",
        "inbound_emails",
        ["org_id", "message_id"],
        unique=True,
        postgresql_where=sa.text("message_id IS NOT NULL"),
    )
    op.create_index(
        "ix_inbound_emails_parsed_candidate_id",
        "inbound_emails",
        ["parsed_candidate_id"],
    )
    op.create_index(
        "ix_inbound_email_attachments_inbound_email_id",
        "inbound_email_attachments",
        ["inbound_email_id"],
    )
    op.create_index(
        "ix_inbound_email_attachments_sha256",
        "inbound_email_attachments",
        ["sha256"],
    )


def downgrade() -> None:
    op.drop_index("ix_inbound_email_attachments_sha256", table_name="inbound_email_attachments")
    op.drop_index(
        "ix_inbound_email_attachments_inbound_email_id",
        table_name="inbound_email_attachments",
    )
    op.drop_index("ix_inbound_emails_parsed_candidate_id", table_name="inbound_emails")
    op.drop_index("ix_inbound_emails_org_message_id_not_null", table_name="inbound_emails")
    op.drop_index("ix_inbound_emails_org_inbox_received_at", table_name="inbound_emails")

    op.drop_table("inbound_email_attachments")
    op.drop_table("inbound_emails")
    op.drop_table("org_inboxes")

    parse_status_enum.drop(op.get_bind(), checkfirst=True)
    inbox_status_enum.drop(op.get_bind(), checkfirst=True)
