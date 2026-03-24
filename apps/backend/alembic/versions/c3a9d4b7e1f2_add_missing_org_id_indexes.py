"""add_missing_org_id_indexes

Revision ID: c3a9d4b7e1f2
Revises: 222c7e591d2d
Create Date: 2026-02-16 15:05:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3a9d4b7e1f2"
down_revision: Union[str, None] = "222c7e591d2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_email_templates_org_id", "email_templates", ["org_id"], unique=False)
    op.create_index("ix_stages_org_id", "stages", ["org_id"], unique=False)
    op.create_index("ix_notes_org_id", "notes", ["org_id"], unique=False)
    op.create_index("ix_emails_org_id", "emails", ["org_id"], unique=False)
    op.create_index("ix_activities_org_id", "activities", ["org_id"], unique=False)
    op.create_index("ix_feedback_org_id", "feedback", ["org_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_feedback_org_id", table_name="feedback")
    op.drop_index("ix_activities_org_id", table_name="activities")
    op.drop_index("ix_emails_org_id", table_name="emails")
    op.drop_index("ix_notes_org_id", table_name="notes")
    op.drop_index("ix_stages_org_id", table_name="stages")
    op.drop_index("ix_email_templates_org_id", table_name="email_templates")
