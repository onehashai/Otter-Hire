"""add conversations and messages tables

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subject", sa.String(length=1000), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False, server_default="email"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("channel IN ('email')", name="ck_conversations_channel"),
        sa.CheckConstraint(
            "status IN ('open', 'closed', 'archived')", name="ck_conversations_status"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_conversations_org_candidate", "conversations", ["org_id", "candidate_id"]
    )
    op.create_index(
        "ix_conversations_org_last_message_at",
        "conversations",
        ["org_id", "last_message_at"],
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("sender_type", sa.String(length=16), nullable=False),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_email", sa.String(length=320), nullable=False),
        sa.Column("to_email", sa.String(length=320), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("provider_message_id", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "direction IN ('inbound', 'outbound')", name="ck_messages_direction"
        ),
        sa.CheckConstraint(
            "sender_type IN ('user', 'candidate')", name="ck_messages_sender_type"
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'sent', 'failed', 'received')", name="ck_messages_status"
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_messages_conversation_created", "messages", ["conversation_id", "created_at"]
    )
    op.create_index("ix_messages_org_id", "messages", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_messages_org_id", table_name="messages")
    op.drop_index("ix_messages_conversation_created", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_conversations_org_last_message_at", table_name="conversations")
    op.drop_index("ix_conversations_org_candidate", table_name="conversations")
    op.drop_table("conversations")
