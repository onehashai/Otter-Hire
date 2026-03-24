"""set jobs workplace_type default to onsite

Revision ID: x0y1z2a3b4c5
Revises: w9x0y1z2a3b4
Create Date: 2026-02-26
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "x0y1z2a3b4c5"
down_revision = "w9x0y1z2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE jobs ALTER COLUMN workplace_type SET DEFAULT 'onsite'")


def downgrade() -> None:
    op.execute("ALTER TABLE jobs ALTER COLUMN workplace_type SET DEFAULT 'remote'")
