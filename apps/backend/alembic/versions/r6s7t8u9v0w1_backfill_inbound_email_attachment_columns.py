"""backfill inbound_emails attachment metadata columns

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
Create Date: 2026-04-01
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "r6s7t8u9v0w1"
down_revision: Union[str, Sequence[str], None] = "q5r6s7t8u9v0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE inbound_emails ie
        SET attachment_count = src.attachment_count
        FROM (
            SELECT inbound_email_id, COUNT(*)::bigint AS attachment_count
            FROM inbound_email_attachments
            GROUP BY inbound_email_id
        ) AS src
        WHERE ie.id = src.inbound_email_id
        """
    )
    op.execute(
        """
        UPDATE inbound_emails ie
        SET
            attachment_primary_storage_key = src.storage_key,
            attachment_primary_sha256 = src.sha256,
            attachment_primary_filename = src.filename,
            attachment_primary_content_type = src.content_type,
            attachment_primary_size_bytes = src.size_bytes
        FROM (
            SELECT DISTINCT ON (inbound_email_id)
                inbound_email_id,
                storage_key,
                sha256,
                filename,
                content_type,
                size_bytes
            FROM inbound_email_attachments
            ORDER BY inbound_email_id, created_at ASC
        ) AS src
        WHERE ie.id = src.inbound_email_id
          AND ie.attachment_primary_storage_key IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE inbound_emails
        SET
            attachment_count = 0,
            attachment_primary_storage_key = NULL,
            attachment_primary_sha256 = NULL,
            attachment_primary_filename = NULL,
            attachment_primary_content_type = NULL,
            attachment_primary_size_bytes = NULL
        """
    )
