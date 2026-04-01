"""expand inbound_emails with attachment metadata columns

Revision ID: q5r6s7t8u9v0
Revises: p4q5r6s7t8u9
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "q5r6s7t8u9v0"
down_revision: Union[str, Sequence[str], None] = "p4q5r6s7t8u9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_count", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_primary_storage_key", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_primary_sha256", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_primary_filename", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_primary_content_type", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "inbound_emails",
        sa.Column("attachment_primary_size_bytes", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inbound_emails", "attachment_primary_size_bytes")
    op.drop_column("inbound_emails", "attachment_primary_content_type")
    op.drop_column("inbound_emails", "attachment_primary_filename")
    op.drop_column("inbound_emails", "attachment_primary_sha256")
    op.drop_column("inbound_emails", "attachment_primary_storage_key")
    op.drop_column("inbound_emails", "attachment_count")
