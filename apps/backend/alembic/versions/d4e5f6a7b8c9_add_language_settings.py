"""Add language settings to organizations and user preferences.

Revision ID: d4e5f6a7b8c9
Revises: c238d064fe75
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c238d064fe75"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SUPPORTED_LANGUAGES = ("en", "es", "fr", "de", "pt", "browser")


def upgrade() -> None:
    bind = op.get_bind()
    has_col = bind.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='jobs_page_language'")
    ).scalar()
    if not has_col:
        op.add_column(
            "organizations",
            sa.Column(
                "jobs_page_language",
                sa.String(length=16),
                nullable=False,
                server_default="en",
            ),
        )
    op.create_check_constraint(
        "ck_organizations_jobs_page_language",
        "organizations",
        f"jobs_page_language IN ({', '.join(repr(lang) for lang in SUPPORTED_LANGUAGES)})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_organizations_jobs_page_language", "organizations", type_="check")
    op.drop_column("organizations", "jobs_page_language")
