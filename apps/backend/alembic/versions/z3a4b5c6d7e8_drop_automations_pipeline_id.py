"""drop automations.pipeline_id and specific_pipeline scope

Revision ID: z3a4b5c6d7e8
Revises: y2z3a4b5c6d7
Create Date: 2026-03-25

Removes unused pipeline_id (never had a FK). Normalizes legacy scope value.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "z3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "y2z3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE automations SET scope = 'all', job_id = NULL "
            "WHERE scope = 'specific_pipeline'"
        )
    )
    op.drop_constraint("ck_automations_scope", "automations", type_="check")
    op.create_check_constraint(
        "ck_automations_scope",
        "automations",
        "scope IN ('all', 'specific_job')",
    )
    op.drop_column("automations", "pipeline_id")


def downgrade() -> None:
    op.add_column(
        "automations",
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.drop_constraint("ck_automations_scope", "automations", type_="check")
    op.create_check_constraint(
        "ck_automations_scope",
        "automations",
        "scope IN ('all', 'specific_job', 'specific_pipeline')",
    )
