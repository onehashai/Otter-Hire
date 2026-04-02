"""add jobs category_id foreign key

Revision ID: m1n2o3p4q5r7
Revises: l9m0n1o2p3q4
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m1n2o3p4q5r7"
down_revision: Union[str, Sequence[str], None] = "l9m0n1o2p3q4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    jobs_columns = [col['name'] for col in inspector.get_columns('jobs')]
    
    if 'category_id' not in jobs_columns:
        op.add_column("jobs", sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True))
    
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_category_id_job_categories') THEN "
        "ALTER TABLE jobs ADD CONSTRAINT fk_jobs_category_id_job_categories "
        "FOREIGN KEY (category_id) REFERENCES job_categories (id) ON DELETE SET NULL; "
        "END IF; END $$"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_jobs_category_id ON jobs (category_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_jobs_org_category_id ON jobs (org_id, category_id)")

    op.execute(
        """
        UPDATE jobs j
        SET category_id = jc.id
        FROM job_categories jc
        WHERE j.org_id = jc.org_id
          AND j.category IS NOT NULL
          AND btrim(j.category) = jc.name
          AND j.category_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_org_category_id", table_name="jobs")
    op.drop_index("ix_jobs_category_id", table_name="jobs")
    op.drop_constraint("fk_jobs_category_id_job_categories", "jobs", type_="foreignkey")
    op.drop_column("jobs", "category_id")
