"""add_candidate_parsed_resume_column

Structured resume parse output lives in ``candidates.parsed_resume`` (JSONB),
not nested under ``profile_links``.

Revision ID: n2o3p4q5r6s7
Revises: a9b8c7d6e5f0
Create Date: 2026-03-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "n2o3p4q5r6s7"
down_revision: Union[str, None] = "a9b8c7d6e5f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "parsed_resume" not in column_names:
        op.add_column(
            "candidates",
            sa.Column("parsed_resume", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    op.execute(
        sa.text("""
        UPDATE candidates
        SET parsed_resume = profile_links->'parsed_resume',
            profile_links = profile_links - 'parsed_resume'
        WHERE profile_links ? 'parsed_resume'
        """)
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("candidates")}
    if "parsed_resume" not in column_names:
        return

    op.execute(
        sa.text("""
        UPDATE candidates
        SET profile_links = COALESCE(profile_links, '{}'::jsonb)
            || jsonb_build_object('parsed_resume', parsed_resume)
        WHERE parsed_resume IS NOT NULL
        """)
    )
    op.drop_column("candidates", "parsed_resume")
