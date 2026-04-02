"""add Candidate_jobs table for multi-job assignments

Revision ID: u1v2w3x4y5z6
Revises: s1t2u3v4w5x6
Create Date: 2026-03-30 13:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "u1v2w3x4y5z6"
down_revision: Union[str, Sequence[str], None] = "s1t2u3v4w5x6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table exists before creating
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    table_exists = "Candidate_jobs" in inspector.get_table_names()
    
    if not table_exists:
        op.create_table(
            "Candidate_jobs",
            sa.Column("assigned_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("stage_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column(
                "assignment_status", sa.String(length=32), nullable=False, server_default="active"
            ),
            sa.Column("source", sa.String(length=100), nullable=True),
            sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "assignment_status IN ('active', 'rejected', 'hired', 'withdrawn')",
                name="ck_candidate_jobs_assignment_status",
            ),
            sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["stage_id"], ["stages.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("assigned_id"),
            sa.UniqueConstraint("candidate_id", "job_id", name="uq_candidate_jobs_candidate_job"),
        )
        op.create_index(
            "ix_candidate_jobs_org_job", "Candidate_jobs", ["org_id", "job_id"], unique=False
        )
        op.create_index(
            "ix_candidate_jobs_org_candidate",
            "Candidate_jobs",
            ["org_id", "candidate_id"],
            unique=False,
        )
        op.create_index(
            "ix_candidate_jobs_org_status_updated",
            "Candidate_jobs",
            ["org_id", "assignment_status", "updated_at"],
            unique=False,
        )

    # Backfill existing single-job candidate assignments into Candidate_jobs.
    op.execute(
        """
        INSERT INTO "Candidate_jobs" (
            assigned_id, org_id, candidate_id, job_id, stage_id,
            assignment_status, source, applied_at, assigned_at, created_at, updated_at
        )
        SELECT
            c.id,
            c.org_id,
            c.id AS candidate_id,
            c.job_id,
            c.stage_id,
            CASE
                WHEN c.status IN ('active', 'rejected', 'hired') THEN c.status
                ELSE 'active'
            END AS assignment_status,
            c.source,
            CASE WHEN c.source = 'job_board' THEN c.created_at ELSE NULL END AS applied_at,
            c.updated_at AS assigned_at,
            c.created_at,
            c.updated_at
        FROM candidates c
        WHERE c.job_id IS NOT NULL
        ON CONFLICT (candidate_id, job_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_candidate_jobs_org_status_updated", table_name="Candidate_jobs")
    op.drop_index("ix_candidate_jobs_org_candidate", table_name="Candidate_jobs")
    op.drop_index("ix_candidate_jobs_org_job", table_name="Candidate_jobs")
    op.drop_table("Candidate_jobs")
