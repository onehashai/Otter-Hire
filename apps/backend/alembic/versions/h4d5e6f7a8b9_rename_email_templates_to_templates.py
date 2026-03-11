"""rename email_templates table to templates

Revision ID: h4d5e6f7a8b9
Revises: g3c4d5e6f7a8
Create Date: 2026-03-11

Renames table email_templates to templates and index to ix_templates_org_id.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "h4d5e6f7a8b9"
down_revision: Union[str, None] = "g3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("email_templates", "templates")
    op.execute("ALTER INDEX ix_email_templates_org_id RENAME TO ix_templates_org_id")


def downgrade() -> None:
    op.execute("ALTER INDEX ix_templates_org_id RENAME TO ix_email_templates_org_id")
    op.rename_table("templates", "email_templates")
