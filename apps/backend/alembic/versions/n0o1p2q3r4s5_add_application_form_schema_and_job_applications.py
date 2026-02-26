"""add_application_form_schema_and_job_applications

Revision ID: n0o1p2q3r4s5
Revises: m9n0o1p2q3r4
Create Date: 2026-02-24 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "n0o1p2q3r4s5"
down_revision: Union[str, None] = "m9n0o1p2q3r4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("application_form_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    op.execute(
        """
        UPDATE jobs
        SET application_form_schema = jsonb_build_object(
            'version', 1,
            'default_fields', jsonb_build_object(
                'full_name', jsonb_build_object('visibility', 'required', 'label', 'Full Name'),
                'email', jsonb_build_object('visibility', 'required', 'label', 'Email'),
                'phone', jsonb_build_object('visibility', 'optional', 'label', 'Phone Number'),
                'resume', jsonb_build_object('visibility', CASE WHEN collect_resume THEN 'required' ELSE 'hidden' END, 'label', 'Resume'),
                'cover_letter', jsonb_build_object('visibility', CASE WHEN collect_cover THEN 'optional' ELSE 'hidden' END, 'label', 'Cover Letter')
            ),
            'custom_fields',
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', 'screening_' || idx::text,
                            'key', 'screening_' || idx::text,
                            'label', q,
                            'type', 'short_text',
                            'visibility', 'optional'
                        )
                        ORDER BY idx
                    )
                    FROM jsonb_array_elements_text(COALESCE(screening_questions, '[]'::jsonb)) WITH ORDINALITY AS x(q, idx)
                ),
                '[]'::jsonb
            )
        )
        """
    )

    op.create_table(
        "job_applications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("files", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("schema_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(), nullable=False, server_default="submitted"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.CheckConstraint("status IN ('submitted', 'in_review', 'rejected', 'hired')", name="ck_job_applications_status"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_applications_org_job_created", "job_applications", ["org_id", "job_id", "created_at"], unique=False)
    op.create_index("ix_job_applications_job_created", "job_applications", ["job_id", "created_at"], unique=False)
    op.create_index("ix_job_applications_org_email", "job_applications", ["org_id", "email"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_applications_org_email", table_name="job_applications")
    op.drop_index("ix_job_applications_job_created", table_name="job_applications")
    op.drop_index("ix_job_applications_org_job_created", table_name="job_applications")
    op.drop_table("job_applications")
    op.drop_column("jobs", "application_form_schema")
