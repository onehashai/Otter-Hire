"""add_candidate_duplicate_review_fields

Revision ID: b7e4a9f1c8f7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-18 17:06:22.805082

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e4a9f1c8f7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to candidates table safely
    op.add_column(
        "candidates",
        sa.Column(
            "is_pending_duplicate_review", sa.Boolean(), server_default="false", nullable=False
        ),
    )
    op.add_column("candidates", sa.Column("possible_duplicate_of_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_candidates_possible_duplicate_of",
        "candidates",
        "candidates",
        ["possible_duplicate_of_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_candidates_possible_duplicate_of", "candidates", type_="foreignkey")
    op.drop_column("candidates", "possible_duplicate_of_id")
    op.drop_column("candidates", "is_pending_duplicate_review")
