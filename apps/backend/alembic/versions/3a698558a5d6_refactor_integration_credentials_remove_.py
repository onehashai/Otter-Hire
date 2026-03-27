"""refactor_integration_credentials_remove_type_add_inbound

Revision ID: 3a698558a5d6
Revises: 019d2a3b4c5d
Create Date: 2026-03-25 14:57:36.084620

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3a698558a5d6"
down_revision: Union[str, None] = "019d2a3b4c5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop unique constraint on (org_id, integration_type)
    op.drop_constraint(
        "uq_integration_credentials_org_type", "integration_credentials", type_="unique"
    )
    op.drop_index("ix_integration_credentials_org_type")

    conn = op.get_bind()

    # 2. Backfill integration_id before dropping integration_type.
    #    019 only linked outbound_email → email; other rows (e.g. linkedin) may still be NULL,
    #    and the LinkedIn master row is added in a later migration — seed stubs here so NOT NULL succeeds.
    conn.execute(
        sa.text("""
        UPDATE integration_credentials ic
        SET integration_id = i.id
        FROM integrations i
        WHERE ic.integration_id IS NULL
          AND ic.integration_type = i.slug
    """)
    )

    conn.execute(
        sa.text("""
        INSERT INTO integrations (id, name, slug, category, logo_url, description, is_active, config)
        SELECT gen_random_uuid(), 'LinkedIn', 'linkedin', 'job_board',
               'https://cdn-icons-png.flaticon.com/512/174/174857.png',
               'Post jobs and share content on LinkedIn', true, '{}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE slug = 'linkedin')
    """)
    )

    conn.execute(
        sa.text("""
        UPDATE integration_credentials ic
        SET integration_id = i.id
        FROM integrations i
        WHERE ic.integration_id IS NULL
          AND ic.integration_type = i.slug
    """)
    )

    conn.execute(
        sa.text("""
        INSERT INTO integrations (id, name, slug, category, logo_url, description, is_active, config)
        SELECT
            gen_random_uuid(),
            initcap(replace(ic.integration_type, '_', ' ')),
            ic.integration_type,
            'other',
            NULL,
            '',
            true,
            '{}'::jsonb
        FROM integration_credentials ic
        WHERE ic.integration_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM integrations i WHERE i.slug = ic.integration_type)
        GROUP BY ic.integration_type
    """)
    )

    conn.execute(
        sa.text("""
        UPDATE integration_credentials ic
        SET integration_id = i.id
        FROM integrations i
        WHERE ic.integration_id IS NULL
          AND ic.integration_type = i.slug
    """)
    )

    remaining = conn.execute(
        sa.text(
            "SELECT integration_type FROM integration_credentials WHERE integration_id IS NULL"
        )
    ).fetchall()
    if remaining:
        types = {row[0] for row in remaining}
        raise RuntimeError(
            "integration_credentials still has NULL integration_id for integration_type(s): "
            f"{sorted(types)} — fix data or add matching integrations rows before re-running."
        )

    # 3. Remove integration_type column
    op.drop_column("integration_credentials", "integration_type")

    # 4. Remove last_tested_at and last_test_error columns
    op.drop_column("integration_credentials", "last_tested_at")
    op.drop_column("integration_credentials", "last_test_error")

    # 5. Make integration_id NOT NULL (required now)
    op.alter_column("integration_credentials", "integration_id", nullable=False)

    # 6. Create unique constraint on (org_id, integration_id)
    op.create_unique_constraint(
        "uq_integration_credentials_org_integration",
        "integration_credentials",
        ["org_id", "integration_id"],
    )

    # 7. Migrate existing org_inboxes data to integration_credentials
    # Get Email integration ID
    result = conn.execute(sa.text("SELECT id FROM integrations WHERE slug = 'email'"))
    email_integration_id = result.fetchone()[0]

    # Insert inbound email config for each org that has org_inboxes
    conn.execute(
        sa.text("""
        INSERT INTO integration_credentials (id, org_id, integration_id, config, status, created_at, updated_at)
        SELECT 
            gen_random_uuid(),
            org_id,
            :email_id,
            jsonb_build_object('inbound_address', inbox_address, 'provider', provider),
            CASE WHEN status = 'active' THEN 'active' ELSE 'pending' END,
            created_at,
            updated_at
        FROM org_inboxes
        ON CONFLICT (org_id, integration_id) DO NOTHING
    """),
        {"email_id": str(email_integration_id)},
    )

    print("✅ Removed integration_type column")
    print("✅ Removed last_tested_at and last_test_error columns")
    print("✅ Made integration_id required")
    print("✅ Created unique constraint on (org_id, integration_id)")
    print("✅ Migrated org_inboxes data to integration_credentials")


def downgrade() -> None:
    # 1. Add back columns
    op.add_column(
        "integration_credentials", sa.Column("integration_type", sa.String(64), nullable=True)
    )
    op.add_column(
        "integration_credentials",
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "integration_credentials", sa.Column("last_test_error", sa.String(2000), nullable=True)
    )

    # 2. Populate integration_type from integration_id
    conn = op.get_bind()
    conn.execute(
        sa.text("""
        UPDATE integration_credentials ic
        SET integration_type = i.slug
        FROM integrations i
        WHERE ic.integration_id = i.id
    """)
    )

    # 3. Make integration_type NOT NULL
    op.alter_column("integration_credentials", "integration_type", nullable=False)

    # 4. Drop new constraint
    op.drop_constraint(
        "uq_integration_credentials_org_integration", "integration_credentials", type_="unique"
    )

    # 5. Make integration_id nullable again
    op.alter_column("integration_credentials", "integration_id", nullable=True)

    # 6. Create old constraints
    op.create_unique_constraint(
        "uq_integration_credentials_org_type",
        "integration_credentials",
        ["org_id", "integration_type"],
    )
    op.create_index(
        "ix_integration_credentials_org_type",
        "integration_credentials",
        ["org_id", "integration_type"],
        unique=True,
    )
