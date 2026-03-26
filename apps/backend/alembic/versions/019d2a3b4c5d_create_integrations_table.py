"""create integrations table

Revision ID: 019d2a3b4c5d
Revises: 8b691f499c40
Create Date: 2026-03-25

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

# revision identifiers
revision = "019d2a3b4c5d"
down_revision = "z3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create integrations table (master list)
    op.create_table(
        "integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("logo_url", sa.Text),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("config", JSONB, default={}, nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # 2. Create indexes
    op.create_index("ix_integrations_slug", "integrations", ["slug"])
    op.create_index("ix_integrations_category", "integrations", ["category"])
    op.create_index("ix_integrations_is_active", "integrations", ["is_active"])

    # 3. Add integration_id to integration_credentials (nullable)
    op.add_column(
        "integration_credentials",
        sa.Column(
            "integration_id", UUID(as_uuid=True), sa.ForeignKey("integrations.id"), nullable=True
        ),
    )
    op.create_index(
        "ix_integration_credentials_integration_id", "integration_credentials", ["integration_id"]
    )

    # 4. Add Email integration (already working in the system)
    conn = op.get_bind()

    # Insert Email integration
    result = conn.execute(
        sa.text("""
        INSERT INTO integrations (id, name, slug, category, logo_url, description, is_active, config)
        VALUES (
            gen_random_uuid(),
            'Email',
            'email',
            'email',
            'https://cdn-icons-png.flaticon.com/512/732/732200.png',
            'Inbound email processing via SES and outbound email via SES',
            true,
            '{}'::jsonb
        )
        RETURNING id
    """)
    )
    email_integration_id = result.fetchone()[0]

    # 5. Link existing outbound_email credentials to Email integration (if any)
    conn.execute(
        sa.text("""
        UPDATE integration_credentials
        SET integration_id = :email_id
        WHERE integration_type = 'outbound_email'
    """),
        {"email_id": str(email_integration_id)},
    )

    print("✅ Created integrations table")
    print("✅ Added Email integration")
    print("✅ Linked existing outbound_email credentials to Email integration")


def downgrade():
    op.drop_index("ix_integration_credentials_integration_id")
    op.drop_column("integration_credentials", "integration_id")
    op.drop_index("ix_integrations_is_active")
    op.drop_index("ix_integrations_category")
    op.drop_index("ix_integrations_slug")
    op.drop_table("integrations")
