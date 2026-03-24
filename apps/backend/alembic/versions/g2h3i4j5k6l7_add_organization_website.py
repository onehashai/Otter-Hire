"""add organization website

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2024-01-20 12:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = 'g2h3i4j5k6l7'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('website', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'website')
