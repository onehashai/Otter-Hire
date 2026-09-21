"""store imported message metadata and batch warnings

Revision ID: 20260921_message_metadata
Revises: 20260918_ats_connection_type
Create Date: 2026-09-21 14:30:00.000000
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260921_message_metadata"
down_revision = "20260918_ats_connection_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    def has_column(table: str, column: str) -> bool:
        return bool(
            bind.execute(
                sa.text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :column"
                ),
                {"table": table, "column": column},
            ).scalar()
        )

    if not has_column("messages", "subject"):
        op.add_column("messages", sa.Column("subject", sa.String(length=1000), nullable=True))
    if not has_column("messages", "references_header"):
        op.add_column("messages", sa.Column("references_header", sa.Text(), nullable=True))
    if not has_column("messages", "source_provider"):
        op.add_column("messages", sa.Column("source_provider", sa.String(length=80), nullable=True))

    has_index = bind.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE schemaname = current_schema() "
            "AND tablename = 'messages' "
            "AND indexname = 'uq_messages_org_source_provider_external'"
        )
    ).scalar()
    if not has_index:
        op.create_index(
            "uq_messages_org_source_provider_external",
            "messages",
            ["org_id", "source_provider", "provider_message_id"],
            unique=True,
            postgresql_where=sa.text(
                "source_provider IS NOT NULL AND provider_message_id IS NOT NULL"
            ),
        )
    if not has_column("import_batches", "warnings"):
        op.add_column(
            "import_batches",
            sa.Column(
                "warnings",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade() -> None:
    op.drop_column("import_batches", "warnings")
    op.drop_index("uq_messages_org_source_provider_external", table_name="messages")
    op.drop_column("messages", "source_provider")
    op.drop_column("messages", "references_header")
    op.drop_column("messages", "subject")
