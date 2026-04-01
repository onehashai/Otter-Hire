"""add job email integration columns

Revision ID: j1k2l3m4n5o6
Revises: z9y8x7w6v5u4
Create Date: 2026-03-31 15:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "j1k2l3m4n5o6"
down_revision: Union[str, Sequence[str], None] = "z9y8x7w6v5u4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("email_inbound_address", sa.String(length=320), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("email_inbound_provider", sa.String(length=32), server_default="ses", nullable=False),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "email_inbound_status", sa.String(length=32), server_default="inactive", nullable=False
        ),
    )
    op.add_column("jobs", sa.Column("email_inbound_secret_hash", sa.String(length=128), nullable=True))
    op.add_column(
        "jobs", sa.Column("email_verification_token_hash", sa.String(length=128), nullable=True)
    )
    op.add_column("jobs", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "jobs",
        sa.Column(
            "email_verification_status", sa.String(length=32), server_default="pending", nullable=False
        ),
    )
    op.add_column("jobs", sa.Column("email_verification_provider", sa.String(length=32), nullable=True))
    op.add_column("jobs", sa.Column("email_verification_email_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("jobs", sa.Column("email_verification_action_type", sa.String(length=32), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("email_verification_action_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("jobs", sa.Column("email_verification_detected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("email_verification_error", sa.String(length=1000), nullable=True))

    op.create_foreign_key(
        "fk_jobs_email_verification_email_id_inbound_emails",
        "jobs",
        "inbound_emails",
        ["email_verification_email_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_jobs_email_inbound_status",
        "jobs",
        "email_inbound_status IN ('inactive', 'pending', 'active')",
    )
    op.create_check_constraint(
        "ck_jobs_email_verification_status",
        "jobs",
        "email_verification_status IN ('pending', 'action_required', 'verified', 'failed')",
    )
    op.create_index(
        "ix_jobs_email_inbound_address_not_null",
        "jobs",
        ["email_inbound_address"],
        unique=True,
        postgresql_where=sa.text("email_inbound_address IS NOT NULL"),
    )

    op.add_column("inbound_emails", sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_inbound_emails_job_id_jobs",
        "inbound_emails",
        "jobs",
        ["job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_inbound_emails_job_id", "inbound_emails", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_inbound_emails_job_id", table_name="inbound_emails")
    op.drop_constraint("fk_inbound_emails_job_id_jobs", "inbound_emails", type_="foreignkey")
    op.drop_column("inbound_emails", "job_id")

    op.drop_index("ix_jobs_email_inbound_address_not_null", table_name="jobs")
    op.drop_constraint("ck_jobs_email_verification_status", "jobs", type_="check")
    op.drop_constraint("ck_jobs_email_inbound_status", "jobs", type_="check")
    op.drop_constraint(
        "fk_jobs_email_verification_email_id_inbound_emails", "jobs", type_="foreignkey"
    )
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
