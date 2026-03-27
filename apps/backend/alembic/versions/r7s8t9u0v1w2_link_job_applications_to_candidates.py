"""link job applications to candidates

Revision ID: r7s8t9u0v1w2
Revises: 8b3d7bb5db2b, c9d0e1f2a3b4, l1n2k3d4i5n6, m1n2o3p4q5r6
Create Date: 2026-03-27 13:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "r7s8t9u0v1w2"
down_revision: Union[str, Sequence[str], None] = (
    "8b3d7bb5db2b",
    "c9d0e1f2a3b4",
    "l1n2k3d4i5n6",
    "m1n2o3p4q5r6",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "job_applications",
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_job_applications_candidate_id_candidates",
        "job_applications",
        "candidates",
        ["candidate_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_job_applications_candidate_created",
        "job_applications",
        ["candidate_id", "created_at"],
        unique=False,
    )

    # Backfill historical rows using deterministic org+job+email match.
    # If multiple candidates match, prefer most recently updated candidate.
    op.execute(
        sa.text(
            """
            UPDATE job_applications AS ja
            SET candidate_id = (
                SELECT c.id
                FROM candidates AS c
                WHERE c.org_id = ja.org_id
                  AND c.job_id = ja.job_id
                  AND lower(c.email) = lower(ja.email)
                ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
                LIMIT 1
            )
            WHERE ja.candidate_id IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_job_applications_candidate_created", table_name="job_applications")
    op.drop_constraint(
        "fk_job_applications_candidate_id_candidates",
        "job_applications",
        type_="foreignkey",
    )
    op.drop_column("job_applications", "candidate_id")
