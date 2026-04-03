"""remove_unused_logo_url_from_integrations

Revision ID: 10a56ea479ce
Revises: d91039ec9434
Create Date: 2026-04-02 10:52:21.913128

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10a56ea479ce'
down_revision: Union[str, None] = 'd91039ec9434'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if column exists before dropping
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('integrations')]
    
    if 'logo_url' in columns:
        op.drop_column('integrations', 'logo_url')


def downgrade() -> None:
    # Add column back if needed
    op.add_column('integrations', sa.Column('logo_url', sa.Text(), nullable=True))
