"""add_linkedin_integration

Revision ID: 8b3d7bb5db2b
Revises: 3a698558a5d6
Create Date: 2026-03-25 16:14:54.740688

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b3d7bb5db2b'
down_revision: Union[str, None] = '3a698558a5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Insert LinkedIn integration
    conn.execute(sa.text("""
        INSERT INTO integrations (id, name, slug, category, logo_url, description, is_active, config)
        VALUES (
            gen_random_uuid(),
            'LinkedIn',
            'linkedin',
            'job_board',
            'https://cdn-icons-png.flaticon.com/512/174/174857.png',
            'Post jobs and share content on LinkedIn',
            true,
            '{}'::jsonb
        )
    """))
    
    print("✅ Added LinkedIn integration")


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM integrations WHERE slug = 'linkedin'"))
