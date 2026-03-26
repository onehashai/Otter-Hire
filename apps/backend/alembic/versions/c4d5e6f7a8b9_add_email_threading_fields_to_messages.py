"""add email threading fields to messages

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-03-10

Adds email_message_id and in_reply_to columns to the messages table to support
inbound email threading (matching candidate replies to existing conversations).
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("email_message_id", sa.String(length=998), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("in_reply_to", sa.String(length=998), nullable=True),
    )
    op.create_index(
        "ix_messages_email_message_id",
        "messages",
        ["email_message_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_email_message_id", table_name="messages")
    op.drop_column("messages", "in_reply_to")
    op.drop_column("messages", "email_message_id")
