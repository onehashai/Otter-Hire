"""add_resume_scoring_to_candidate_jobs

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-24 20:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "Candidate_jobs",
        sa.Column("resume_score_generation", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("Candidate_jobs", sa.Column("resume_score", sa.Integer(), nullable=True))
    op.add_column(
        "Candidate_jobs", sa.Column("resume_score_status", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "Candidate_jobs",
        sa.Column("resume_score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "Candidate_jobs", sa.Column("resume_score_scored_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint(
        "ck_candidate_jobs_resume_score_status",
        "Candidate_jobs",
        "resume_score_status IS NULL OR resume_score_status IN ('pending', 'ready', 'failed')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_candidate_jobs_resume_score_status", "Candidate_jobs", type_="check")
    op.drop_column("Candidate_jobs", "resume_score_scored_at")
    op.drop_column("Candidate_jobs", "resume_score_breakdown")
    op.drop_column("Candidate_jobs", "resume_score_status")
    op.drop_column("Candidate_jobs", "resume_score")
    op.drop_column("Candidate_jobs", "resume_score_generation")
