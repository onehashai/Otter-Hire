"""drop legacy org/job email integration columns

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "o3p4q5r6s7t8"
down_revision: Union[str, Sequence[str], None] = "n2o3p4q5r6s7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_organizations_inbox_address_not_null")
    op.execute("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_inbox_status")
    op.execute(
        "ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_inbox_verification_status"
    )
    op.execute(
        "ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_organizations_inbox_verification_email_id"
    )
    op.drop_column("organizations", "inbox_verification_error")
    op.drop_column("organizations", "inbox_verification_detected_at")
    op.drop_column("organizations", "inbox_verification_action_payload")
    op.drop_column("organizations", "inbox_verification_action_type")
    op.drop_column("organizations", "inbox_verification_email_id")
    op.drop_column("organizations", "inbox_verification_provider")
    op.drop_column("organizations", "inbox_verification_status")
    op.drop_column("organizations", "inbox_verified_at")
    op.drop_column("organizations", "inbox_verification_expires_at")
    op.drop_column("organizations", "inbox_verification_token_hash")
    op.drop_column("organizations", "inbox_secret_hash")
    op.drop_column("organizations", "inbox_status")
    op.drop_column("organizations", "inbox_provider")
    op.drop_column("organizations", "inbox_address")

    op.execute("DROP INDEX IF EXISTS ix_jobs_email_inbound_address_not_null")
    op.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS ck_jobs_email_inbound_status")
    op.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS ck_jobs_email_verification_status")
    op.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_email_verification_email_id_fkey")
    op.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS fk_jobs_email_verification_email_id")
    op.drop_column("jobs", "email_verification_error")
    op.drop_column("jobs", "email_verification_detected_at")
    op.drop_column("jobs", "email_verification_action_payload")
    op.drop_column("jobs", "email_verification_action_type")
    op.drop_column("jobs", "email_verification_email_id")
    op.drop_column("jobs", "email_verification_provider")
    op.drop_column("jobs", "email_verification_status")
    op.drop_column("jobs", "email_verified_at")
    op.drop_column("jobs", "email_verification_expires_at")
    op.drop_column("jobs", "email_verification_token_hash")
    op.drop_column("jobs", "email_inbound_secret_hash")
    op.drop_column("jobs", "email_inbound_status")
    op.drop_column("jobs", "email_inbound_provider")
    op.drop_column("jobs", "email_inbound_address")


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for legacy-column removal")
