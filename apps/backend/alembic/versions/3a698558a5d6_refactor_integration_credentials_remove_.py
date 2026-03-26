"""refactor_integration_credentials_remove_type_add_inbound

Revision ID: 3a698558a5d6
Revises: 019d2a3b4c5d
Create Date: 2026-03-25 14:57:36.084620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a698558a5d6'
down_revision: Union[str, None] = '019d2a3b4c5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop unique constraint on (org_id, integration_type)
    op.drop_constraint('uq_integration_credentials_org_type', 'integration_credentials', type_='unique')
    op.drop_index('ix_integration_credentials_org_type')
    
    # 2. Remove integration_type column
    op.drop_column('integration_credentials', 'integration_type')
    
    # 3. Remove last_tested_at and last_test_error columns
    op.drop_column('integration_credentials', 'last_tested_at')
    op.drop_column('integration_credentials', 'last_test_error')
    
    # 4. Make integration_id NOT NULL (required now)
    op.alter_column('integration_credentials', 'integration_id', nullable=False)
    
    # 5. Create unique constraint on (org_id, integration_id)
    op.create_unique_constraint('uq_integration_credentials_org_integration', 'integration_credentials', ['org_id', 'integration_id'])
    
    # 6. Migrate existing org_inboxes data to integration_credentials
    conn = op.get_bind()
    
    # Get Email integration ID
    result = conn.execute(sa.text("SELECT id FROM integrations WHERE slug = 'email'"))
    email_integration_id = result.fetchone()[0]
    
    # Insert inbound email config for each org that has org_inboxes
    conn.execute(sa.text("""
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
    """), {'email_id': str(email_integration_id)})
    
    print("✅ Removed integration_type column")
    print("✅ Removed last_tested_at and last_test_error columns")
    print("✅ Made integration_id required")
    print("✅ Created unique constraint on (org_id, integration_id)")
    print("✅ Migrated org_inboxes data to integration_credentials")


def downgrade() -> None:
    # 1. Add back columns
    op.add_column('integration_credentials', sa.Column('integration_type', sa.String(64), nullable=True))
    op.add_column('integration_credentials', sa.Column('last_tested_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('integration_credentials', sa.Column('last_test_error', sa.String(2000), nullable=True))
    
    # 2. Populate integration_type from integration_id
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE integration_credentials ic
        SET integration_type = i.slug
        FROM integrations i
        WHERE ic.integration_id = i.id
    """))
    
    # 3. Make integration_type NOT NULL
    op.alter_column('integration_credentials', 'integration_type', nullable=False)
    
    # 4. Drop new constraint
    op.drop_constraint('uq_integration_credentials_org_integration', 'integration_credentials', type_='unique')
    
    # 5. Make integration_id nullable again
    op.alter_column('integration_credentials', 'integration_id', nullable=True)
    
    # 6. Create old constraints
    op.create_unique_constraint('uq_integration_credentials_org_type', 'integration_credentials', ['org_id', 'integration_type'])
    op.create_index('ix_integration_credentials_org_type', 'integration_credentials', ['org_id', 'integration_type'], unique=True)
