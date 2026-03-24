"""add integration_credentials table and move credentials out of integrations

Revision ID: b7c8d9e0f1a2
Revises: e6f7a8b9c0d1
Create Date: 2026-03-12

Creates integration_credentials table to hold encrypted credentials for all
integrations across all orgs. Migrates existing data from integrations.encrypted_credentials,
then drops that column.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "integration_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("integration_type", sa.String(length=64), nullable=False),
        sa.Column("encrypted_credentials", sa.String(length=4096), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "org_id", "integration_type", name="uq_integration_credentials_org_type"
        ),
    )
    op.create_index("ix_integration_credentials_org_id", "integration_credentials", ["org_id"])
    op.create_index(
        "ix_integration_credentials_org_type",
        "integration_credentials",
        ["org_id", "integration_type"],
        unique=True,
    )

    # Migrate existing credentials from integrations into integration_credentials
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO integration_credentials (id, org_id, integration_type, encrypted_credentials, created_at, updated_at)
            SELECT gen_random_uuid(), org_id, integration_type, encrypted_credentials, created_at, updated_at
            FROM integrations
            WHERE encrypted_credentials IS NOT NULL AND encrypted_credentials != ''
            """
        )
    )

    op.drop_column("integrations", "encrypted_credentials")


def downgrade() -> None:
    op.add_column(
        "integrations",
        sa.Column("encrypted_credentials", sa.String(length=4096), nullable=True),
    )
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE integrations i
            SET encrypted_credentials = c.encrypted_credentials
            FROM integration_credentials c
            WHERE i.org_id = c.org_id AND i.integration_type = c.integration_type
            """
        )
    )
    op.drop_index("ix_integration_credentials_org_type", table_name="integration_credentials")
    op.drop_index("ix_integration_credentials_org_id", table_name="integration_credentials")
    op.drop_table("integration_credentials")
