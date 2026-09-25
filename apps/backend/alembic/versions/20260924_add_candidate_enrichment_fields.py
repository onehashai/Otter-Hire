"""add candidate enrichment fields

Revision ID: 20260924_candidate_enrichment
Revises: 20260924_add_inbound_processing_status
Create Date: 2026-09-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260924_candidate_enrichment"
down_revision: Union[str, None] = "20260924_inbound_processing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(name: str) -> bool:
    return bool(
        op.get_bind()
        .execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'candidates' AND column_name = :name"
            ),
            {"name": name},
        )
        .scalar()
    )


def upgrade() -> None:
    columns = {
        "avatar_url": sa.Column("avatar_url", sa.String(), nullable=True),
        "headline": sa.Column("headline", sa.String(), nullable=True),
        "profile_links": sa.Column(
            "profile_links",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        "is_enriched": sa.Column(
            "is_enriched", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        "enriched_at": sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=True),
    }
    for name, column in columns.items():
        if not _has_column(name):
            op.add_column("candidates", column)


def downgrade() -> None:
    for name in ("enriched_at", "is_enriched", "profile_links", "headline", "avatar_url"):
        if _has_column(name):
            op.drop_column("candidates", name)
