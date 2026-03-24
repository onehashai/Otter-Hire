"""drop integrations table and merge into integration_credentials

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-03-12

Adds config, status, last_tested_at, last_test_error to integration_credentials,
migrates all data from integrations, then drops the integrations table.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make encrypted_credentials nullable
    op.alter_column(
        "integration_credentials",
        "encrypted_credentials",
        existing_type=sa.String(4096),
        nullable=True,
    )
    # Add columns that were on integrations
    op.add_column(
        "integration_credentials",
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
    op.add_column(
        "integration_credentials",
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
    )
    op.add_column(
        "integration_credentials",
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "integration_credentials",
        sa.Column("last_test_error", sa.String(2000), nullable=True),
    )

    conn = op.get_bind()

    # Update existing integration_credentials rows with config/status from integrations
    conn.execute(
        sa.text(
            """
            UPDATE integration_credentials c
            SET config = i.config, status = i.status, last_tested_at = i.last_tested_at, last_test_error = i.last_test_error
            FROM integrations i
            WHERE c.org_id = i.org_id AND c.integration_type = i.integration_type
            """
        )
    )

    # Insert rows from integrations that don't yet exist in integration_credentials
    conn.execute(
        sa.text(
            """
            INSERT INTO integration_credentials (id, org_id, integration_type, encrypted_credentials, config, status, last_tested_at, last_test_error, created_at, updated_at)
            SELECT i.id, i.org_id, i.integration_type, NULL, i.config, i.status, i.last_tested_at, i.last_test_error, i.created_at, i.updated_at
            FROM integrations i
            WHERE NOT EXISTS (
                SELECT 1 FROM integration_credentials c
                WHERE c.org_id = i.org_id AND c.integration_type = i.integration_type
            )
            """
        )
    )

    op.drop_index("ix_integrations_org_type", table_name="integrations")
    op.drop_index("ix_integrations_org_id", table_name="integrations")
    op.drop_table("integrations")


def downgrade() -> None:
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("integration_type", sa.String(64), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_error", sa.String(2000), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "integration_type", name="uq_integrations_org_type"),
    )
    op.create_index("ix_integrations_org_id", "integrations", ["org_id"])
    op.create_index(
        "ix_integrations_org_type", "integrations", ["org_id", "integration_type"], unique=True
    )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO integrations (id, org_id, integration_type, config, status, last_tested_at, last_test_error, created_at, updated_at)
            SELECT id, org_id, integration_type, config, status, last_tested_at, last_test_error, created_at, updated_at
            FROM integration_credentials
            """
        )
    )

    op.drop_column("integration_credentials", "last_test_error")
    op.drop_column("integration_credentials", "last_tested_at")
    op.drop_column("integration_credentials", "status")
    op.drop_column("integration_credentials", "config")
    # Restore NOT NULL: rows with null credentials get empty string so alter succeeds
    conn.execute(
        sa.text(
            "UPDATE integration_credentials SET encrypted_credentials = '' WHERE encrypted_credentials IS NULL"
        )
    )
    op.alter_column(
        "integration_credentials",
        "encrypted_credentials",
        existing_type=sa.String(4096),
        nullable=False,
    )
