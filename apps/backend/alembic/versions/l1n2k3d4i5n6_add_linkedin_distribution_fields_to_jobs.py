"""add_linkedin_distribution_fields_to_jobs

Revision ID: l1n2k3d4i5n6
Revises: r4s5t6u7v8w9
Create Date: 2026-03-27 12:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l1n2k3d4i5n6"
down_revision: Union[str, None] = "r4s5t6u7v8w9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("jobs")}

    with op.batch_alter_table("jobs") as batch_op:
        if "post_to_linkedin" not in column_names:
            batch_op.add_column(
                sa.Column("post_to_linkedin", sa.Boolean(), nullable=False, server_default="false")
            )
        if "linkedin_sync_status" not in column_names:
            batch_op.add_column(
                sa.Column(
                    "linkedin_sync_status",
                    sa.String(length=20),
                    nullable=False,
                    server_default="not_posted",
                )
            )
        if "linkedin_external_job_id" not in column_names:
            batch_op.add_column(sa.Column("linkedin_external_job_id", sa.String(length=255)))
        if "linkedin_last_synced_at" not in column_names:
            batch_op.add_column(sa.Column("linkedin_last_synced_at", sa.DateTime(timezone=True)))
        if "linkedin_last_error" not in column_names:
            batch_op.add_column(sa.Column("linkedin_last_error", sa.Text()))

    check_names = {c["name"] for c in inspector.get_check_constraints("jobs")}
    if "ck_jobs_linkedin_sync_status" not in check_names:
        op.create_check_constraint(
            "ck_jobs_linkedin_sync_status",
            "jobs",
            "linkedin_sync_status IN ('not_posted', 'posting', 'posted', 'failed')",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("jobs")}
    check_names = {c["name"] for c in inspector.get_check_constraints("jobs")}

    if "ck_jobs_linkedin_sync_status" in check_names:
        op.drop_constraint("ck_jobs_linkedin_sync_status", "jobs", type_="check")

    with op.batch_alter_table("jobs") as batch_op:
        if "linkedin_last_error" in column_names:
            batch_op.drop_column("linkedin_last_error")
        if "linkedin_last_synced_at" in column_names:
            batch_op.drop_column("linkedin_last_synced_at")
        if "linkedin_external_job_id" in column_names:
            batch_op.drop_column("linkedin_external_job_id")
        if "linkedin_sync_status" in column_names:
            batch_op.drop_column("linkedin_sync_status")
        if "post_to_linkedin" in column_names:
            batch_op.drop_column("post_to_linkedin")
