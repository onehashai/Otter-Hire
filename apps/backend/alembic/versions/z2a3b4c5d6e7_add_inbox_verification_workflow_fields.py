"""add inbox verification workflow fields

Revision ID: z2a3b4c5d6e7
Revises: y1z2a3b4c5d6
Create Date: 2026-02-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "z2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "y1z2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "org_inboxes",
        sa.Column(
            "verification_status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "org_inboxes",
        sa.Column("verification_provider", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "org_inboxes",
        sa.Column("verification_email_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "org_inboxes",
        sa.Column("verification_action_type", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "org_inboxes",
        sa.Column(
            "verification_action_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "org_inboxes",
        sa.Column("verification_detected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "org_inboxes",
        sa.Column("verification_error", sa.String(length=1000), nullable=True),
    )
    op.create_foreign_key(
        "fk_org_inboxes_verification_email_id",
        "org_inboxes",
        "inbound_emails",
        ["verification_email_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "inbound_emails",
        sa.Column("email_kind", sa.String(length=32), nullable=False, server_default="candidate"),
    )


def downgrade() -> None:
    op.drop_column("inbound_emails", "email_kind")
    op.drop_constraint("fk_org_inboxes_verification_email_id", "org_inboxes", type_="foreignkey")
    op.drop_column("org_inboxes", "verification_error")
    op.drop_column("org_inboxes", "verification_detected_at")
    op.drop_column("org_inboxes", "verification_action_payload")
    op.drop_column("org_inboxes", "verification_action_type")
    op.drop_column("org_inboxes", "verification_email_id")
    op.drop_column("org_inboxes", "verification_provider")
    op.drop_column("org_inboxes", "verification_status")
