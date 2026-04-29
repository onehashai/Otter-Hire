"""refactor resume scoring storage to sections

Revision ID: c9d8e7f6a5b4
Revises: b2c3d4e5f6a7
Create Date: 2026-04-24 22:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "Candidate_jobs",
        sa.Column("resume_score_sections", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.drop_column("Candidate_jobs", "resume_score_scored_at")
    op.drop_column("Candidate_jobs", "resume_score_breakdown")


def downgrade() -> None:
    op.add_column(
        "Candidate_jobs",
        sa.Column("resume_score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "Candidate_jobs",
        sa.Column("resume_score_scored_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.drop_column("Candidate_jobs", "resume_score_sections")
