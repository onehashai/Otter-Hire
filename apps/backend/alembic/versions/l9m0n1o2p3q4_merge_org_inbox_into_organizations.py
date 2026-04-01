"""merge org inbox into organizations

Revision ID: l9m0n1o2p3q4
Revises: k7l8m9n0o1p2
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "l9m0n1o2p3q4"
down_revision: Union[str, Sequence[str], None] = "k7l8m9n0o1p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("inbox_address", sa.String(length=320), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("inbox_provider", sa.String(length=32), nullable=False, server_default="ses"),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_status", sa.String(length=32), nullable=False, server_default="inactive"),
    )
    op.add_column("organizations", sa.Column("inbox_secret_hash", sa.String(length=128), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_token_hash", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("organizations", sa.Column("inbox_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "organizations",
        sa.Column(
            "inbox_verification_status", sa.String(length=32), nullable=False, server_default="pending"
        ),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_provider", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_email_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_action_type", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "inbox_verification_action_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_detected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("inbox_verification_error", sa.String(length=1000), nullable=True),
    )

    op.create_foreign_key(
        "fk_organizations_inbox_verification_email_id",
        "organizations",
        "inbound_emails",
        ["inbox_verification_email_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_organizations_inbox_status",
        "organizations",
        "inbox_status IN ('inactive', 'pending', 'active')",
    )
    op.create_check_constraint(
        "ck_organizations_inbox_verification_status",
        "organizations",
        "inbox_verification_status IN ('pending', 'action_required', 'verified', 'failed')",
    )
    op.create_index(
        "ix_organizations_inbox_address_not_null",
        "organizations",
        ["inbox_address"],
        unique=True,
        postgresql_where=sa.text("inbox_address IS NOT NULL"),
    )

    op.execute(
        """
        UPDATE organizations o
        SET
            inbox_address = oi.inbox_address,
            inbox_provider = oi.provider,
            inbox_status = oi.status::text,
            inbox_secret_hash = oi.secret_hash,
            inbox_verification_token_hash = oi.verification_token_hash,
            inbox_verification_expires_at = oi.verification_expires_at,
            inbox_verified_at = oi.verified_at,
            inbox_verification_status = oi.verification_status,
            inbox_verification_provider = oi.verification_provider,
            inbox_verification_email_id = oi.verification_email_id,
            inbox_verification_action_type = oi.verification_action_type,
            inbox_verification_action_payload = oi.verification_action_payload,
            inbox_verification_detected_at = oi.verification_detected_at,
            inbox_verification_error = oi.verification_error
        FROM org_inboxes oi
        WHERE o.id = oi.org_id
        """
    )

    op.drop_constraint("fk_org_inboxes_verification_email_id", "org_inboxes", type_="foreignkey")
    op.drop_table("org_inboxes")
    op.execute("DROP TYPE IF EXISTS org_inbox_status")


def downgrade() -> None:
    inbox_status_enum = sa.Enum("inactive", "pending", "active", name="org_inbox_status")
    inbox_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "org_inboxes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inbox_address", sa.String(length=320), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="ses"),
        sa.Column("status", inbox_status_enum, nullable=False, server_default="inactive"),
        sa.Column("secret_hash", sa.String(length=128), nullable=True),
        sa.Column("verification_token_hash", sa.String(length=128), nullable=True),
        sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("verification_provider", sa.String(length=32), nullable=True),
        sa.Column("verification_email_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("verification_action_type", sa.String(length=32), nullable=True),
        sa.Column(
            "verification_action_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("verification_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_error", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", name="uq_org_inboxes_org_id"),
        sa.UniqueConstraint("inbox_address", name="uq_org_inboxes_inbox_address"),
    )
    op.create_foreign_key(
        "fk_org_inboxes_verification_email_id",
        "org_inboxes",
        "inbound_emails",
        ["verification_email_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        INSERT INTO org_inboxes (
            id,
            org_id,
            inbox_address,
            provider,
            status,
            secret_hash,
            verification_token_hash,
            verification_expires_at,
            verified_at,
            verification_status,
            verification_provider,
            verification_email_id,
            verification_action_type,
            verification_action_payload,
            verification_detected_at,
            verification_error,
            created_at,
            updated_at
        )
        SELECT
            gen_random_uuid(),
            o.id,
            o.inbox_address,
            COALESCE(o.inbox_provider, 'ses'),
            COALESCE(o.inbox_status, 'inactive')::org_inbox_status,
            o.inbox_secret_hash,
            o.inbox_verification_token_hash,
            o.inbox_verification_expires_at,
            o.inbox_verified_at,
            COALESCE(o.inbox_verification_status, 'pending'),
            o.inbox_verification_provider,
            o.inbox_verification_email_id,
            o.inbox_verification_action_type,
            o.inbox_verification_action_payload,
            o.inbox_verification_detected_at,
            o.inbox_verification_error,
            NOW(),
            NOW()
        FROM organizations o
        WHERE o.inbox_address IS NOT NULL
        """
    )

    op.drop_index("ix_organizations_inbox_address_not_null", table_name="organizations")
    op.drop_constraint("ck_organizations_inbox_verification_status", "organizations", type_="check")
    op.drop_constraint("ck_organizations_inbox_status", "organizations", type_="check")
    op.drop_constraint(
        "fk_organizations_inbox_verification_email_id", "organizations", type_="foreignkey"
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
