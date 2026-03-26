"""jobs v1 contract - expand job model, create job_team_members

Revision ID: f1a2b3c4d5e6
Revises: e5f8a9b2c3d4
Create Date: 2026-02-18 12:00:00.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str = "e5f8a9b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("department", sa.String(50), nullable=True))
    op.add_column(
        "jobs", sa.Column("workplace_type", sa.String(10), server_default="remote", nullable=True)
    )
    op.add_column("jobs", sa.Column("country", sa.String(2), nullable=True))
    op.add_column("jobs", sa.Column("city", sa.String(255), nullable=True))
    op.add_column("jobs", sa.Column("openings", sa.Integer(), server_default="1", nullable=False))
    op.add_column(
        "jobs", sa.Column("salary_type", sa.String(10), server_default="hidden", nullable=False)
    )
    op.add_column("jobs", sa.Column("salary_min", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("salary_max", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("salary_fixed", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("currency", sa.String(3), server_default="USD", nullable=True))
    op.add_column(
        "jobs",
        sa.Column("salary_timeframe", sa.String(10), server_default="per_year", nullable=True),
    )
    op.add_column(
        "jobs", sa.Column("visibility", sa.String(10), server_default="internal", nullable=False)
    )
    op.add_column(
        "jobs", sa.Column("collect_resume", sa.Boolean(), server_default="true", nullable=False)
    )
    op.add_column(
        "jobs", sa.Column("collect_cover", sa.Boolean(), server_default="false", nullable=False)
    )
    op.add_column(
        "jobs",
        sa.Column("screening_questions", postgresql.JSONB(), server_default="[]", nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column("pipeline_template", sa.String(20), server_default="standard", nullable=True),
    )
    op.add_column("jobs", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))

    op.drop_column("jobs", "location")

    op.drop_constraint("ck_jobs_status", "jobs", type_="check")
    op.execute("UPDATE jobs SET status = 'open' WHERE status = 'published'")
    op.create_check_constraint("ck_jobs_status", "jobs", "status IN ('draft', 'open', 'closed')")

    op.create_check_constraint(
        "ck_jobs_visibility", "jobs", "visibility IN ('internal', 'careers', 'public')"
    )
    op.create_check_constraint(
        "ck_jobs_salary_type", "jobs", "salary_type IN ('hidden', 'fixed', 'range')"
    )
    op.create_check_constraint(
        "ck_jobs_salary_range",
        "jobs",
        "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
    )

    op.create_index("ix_jobs_org_status", "jobs", ["org_id", "status"])

    op.create_unique_constraint("uq_stages_job_position", "stages", ["job_id", "position"])

    op.create_table(
        "job_team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("job_id", "user_id", name="uq_job_team_member"),
        sa.CheckConstraint(
            "role IN ('hiring_manager', 'recruiter', 'interviewer', 'coordinator')",
            name="ck_job_team_role",
        ),
        sa.Index("ix_job_team_members_job", "job_id"),
    )


def downgrade() -> None:
    op.drop_table("job_team_members")

    op.drop_constraint("uq_stages_job_position", "stages", type_="unique")

    op.drop_index("ix_jobs_org_status", table_name="jobs")
    op.drop_constraint("ck_jobs_salary_range", "jobs", type_="check")
    op.drop_constraint("ck_jobs_salary_type", "jobs", type_="check")
    op.drop_constraint("ck_jobs_visibility", "jobs", type_="check")

    op.drop_constraint("ck_jobs_status", "jobs", type_="check")
    op.execute("UPDATE jobs SET status = 'published' WHERE status = 'open'")
    op.create_check_constraint(
        "ck_jobs_status", "jobs", "status IN ('draft', 'published', 'closed')"
    )

    op.add_column("jobs", sa.Column("location", sa.String(), nullable=True))

    op.drop_column("jobs", "closed_at")
    op.drop_column("jobs", "published_at")
    op.drop_column("jobs", "pipeline_template")
    op.drop_column("jobs", "screening_questions")
    op.drop_column("jobs", "collect_cover")
    op.drop_column("jobs", "collect_resume")
    op.drop_column("jobs", "visibility")
    op.drop_column("jobs", "salary_timeframe")
    op.drop_column("jobs", "currency")
    op.drop_column("jobs", "salary_fixed")
    op.drop_column("jobs", "salary_max")
    op.drop_column("jobs", "salary_min")
    op.drop_column("jobs", "salary_type")
    op.drop_column("jobs", "openings")
    op.drop_column("jobs", "city")
    op.drop_column("jobs", "country")
    op.drop_column("jobs", "workplace_type")
    op.drop_column("jobs", "department")
