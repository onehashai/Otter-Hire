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
    bind = op.get_bind()
    has_gen = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='Candidate_jobs' AND column_name='resume_score_generation'")
    ).scalar()
    if not has_gen:
        op.add_column(
            "Candidate_jobs",
            sa.Column("resume_score_generation", sa.Integer(), nullable=False, server_default="0"),
        )
    
    has_score = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='Candidate_jobs' AND column_name='resume_score'")
    ).scalar()
    if not has_score:
        op.add_column("Candidate_jobs", sa.Column("resume_score", sa.Integer(), nullable=True))
    
    has_status = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='Candidate_jobs' AND column_name='resume_score_status'")
    ).scalar()
    if not has_status:
        op.add_column(
            "Candidate_jobs", sa.Column("resume_score_status", sa.String(length=20), nullable=True)
        )
    
    has_breakdown = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='Candidate_jobs' AND column_name='resume_score_breakdown'")
    ).scalar()
    if not has_breakdown:
        op.add_column(
            "Candidate_jobs",
            sa.Column("resume_score_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    
    has_scored_at = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='Candidate_jobs' AND column_name='resume_score_scored_at'")
    ).scalar()
    if not has_scored_at:
        op.add_column(
            "Candidate_jobs",
            sa.Column("resume_score_scored_at", sa.DateTime(timezone=True), nullable=True),
        )

    has_ck = bind.execute(
        sa.text("SELECT 1 FROM information_schema.table_constraints WHERE table_name='Candidate_jobs' AND constraint_name='ck_candidate_jobs_resume_score_status'")
    ).scalar()
    if not has_ck:
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
