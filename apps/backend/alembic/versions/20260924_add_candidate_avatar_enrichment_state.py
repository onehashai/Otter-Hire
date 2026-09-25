"""add candidate avatar enrichment state

Revision ID: 20260924_avatar_enrichment_state
Revises: 20260924_candidate_enrichment
Create Date: 2026-09-24
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_avatar_enrichment_state"
down_revision: Union[str, None] = "20260924_candidate_enrichment"
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


def _has_index(name: str) -> bool:
    return bool(
        op.get_bind()
        .execute(
            sa.text("SELECT 1 FROM pg_indexes WHERE tablename = 'candidates' AND indexname = :name"),
            {"name": name},
        )
        .scalar()
    )


def upgrade() -> None:
    columns = {
        "avatar_enrichment_status": sa.Column("avatar_enrichment_status", sa.String(32), nullable=True),
        "avatar_enrichment_error": sa.Column("avatar_enrichment_error", sa.String(255), nullable=True),
        "avatar_retry_at": sa.Column("avatar_retry_at", sa.DateTime(timezone=True), nullable=True),
        "avatar_source": sa.Column("avatar_source", sa.String(64), nullable=True),
    }
    for name, column in columns.items():
        if not _has_column(name):
            op.add_column("candidates", column)
    if not _has_index("ix_candidates_avatar_retry"):
        op.create_index(
            "ix_candidates_avatar_retry",
            "candidates",
            ["avatar_enrichment_status", "avatar_retry_at"],
        )


def downgrade() -> None:
    if _has_index("ix_candidates_avatar_retry"):
        op.drop_index("ix_candidates_avatar_retry", table_name="candidates")
    for name in (
        "avatar_source",
        "avatar_retry_at",
        "avatar_enrichment_error",
        "avatar_enrichment_status",
    ):
        if _has_column(name):
            op.drop_column("candidates", name)
