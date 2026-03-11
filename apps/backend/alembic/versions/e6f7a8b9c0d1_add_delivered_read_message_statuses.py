"""add delivered and read message statuses

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-10

Extends the messages.status check constraint to allow 'delivered' and 'read'
in addition to the existing queued/sent/failed/received values.
'delivered'  — SES confirmed delivery to the recipient's mail server (via SNS webhook)
'read'       — Recipient opened the email (tracking pixel or SES open event)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_messages_status", "messages")
    op.create_check_constraint(
        "ck_messages_status",
        "messages",
        "status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_messages_status", "messages")
    op.create_check_constraint(
        "ck_messages_status",
        "messages",
        "status IN ('queued', 'sent', 'failed', 'received')",
    )
