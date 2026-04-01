"""add jobs category_id foreign key

Revision ID: m1n2o3p4q5r7
Revises: l9m0n1o2p3q4
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "m1n2o3p4q5r7"
down_revision: Union[str, Sequence[str], None] = "l9m0n1o2p3q4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_jobs_category_id_job_categories",
        "jobs",
        "job_categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_jobs_category_id", "jobs", ["category_id"], unique=False)
    op.create_index("ix_jobs_org_category_id", "jobs", ["org_id", "category_id"], unique=False)

    op.execute(
        """
        UPDATE jobs j
        SET category_id = jc.id
        FROM job_categories jc
        WHERE j.org_id = jc.org_id
          AND j.category IS NOT NULL
          AND btrim(j.category) = jc.name
        """
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_org_category_id", table_name="jobs")
    op.drop_index("ix_jobs_category_id", table_name="jobs")
    op.drop_constraint("fk_jobs_category_id_job_categories", "jobs", type_="foreignkey")
    op.drop_column("jobs", "category_id")
