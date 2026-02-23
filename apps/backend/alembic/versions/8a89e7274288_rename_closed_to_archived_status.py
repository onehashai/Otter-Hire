"""rename_closed_to_archived_status

Revision ID: 8a89e7274288
Revises: ba9696d1232c
Create Date: 2026-02-23 09:53:43.471603

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a89e7274288'
down_revision: Union[str, None] = 'ba9696d1232c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old constraint
    op.drop_constraint('ck_jobs_status', 'jobs', type_='check')
    
    # Update existing 'closed' status to 'archived'
    op.execute("UPDATE jobs SET status = 'archived' WHERE status = 'closed'")
    
    # Add new constraint with 'archived' instead of 'closed'
    op.create_check_constraint(
        'ck_jobs_status',
        'jobs',
        "status IN ('draft', 'open', 'archived')"
    )


def downgrade() -> None:
    # Drop new constraint
    op.drop_constraint('ck_jobs_status', 'jobs', type_='check')
    
    # Revert 'archived' status back to 'closed'
    op.execute("UPDATE jobs SET status = 'closed' WHERE status = 'archived'")
    
    # Restore old constraint
    op.create_check_constraint(
        'ck_jobs_status',
        'jobs',
        "status IN ('draft', 'open', 'closed')"
    )
