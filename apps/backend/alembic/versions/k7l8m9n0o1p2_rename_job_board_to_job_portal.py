"""rename job_board to job_portal in source and integration category

Revision ID: k7l8m9n0o1p2
Revises: j1k2l3m4n5o6
Create Date: 2026-04-01

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "k7l8m9n0o1p2"
down_revision: Union[str, Sequence[str], None] = "j1k2l3m4n5o6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE candidates
        SET source = 'job_portal'
        WHERE source = 'job_board'
        """
    )
    op.execute(
        """
        UPDATE "Candidate_jobs"
        SET source = 'job_portal'
        WHERE source = 'job_board'
        """
    )
    op.execute(
        """
        UPDATE integrations
        SET category = 'job_portal'
        WHERE category = 'job_board'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE candidates
        SET source = 'job_board'
        WHERE source = 'job_portal'
        """
    )
    op.execute(
        """
        UPDATE "Candidate_jobs"
        SET source = 'job_board'
        WHERE source = 'job_portal'
        """
    )
    op.execute(
        """
        UPDATE integrations
        SET category = 'job_board'
        WHERE category = 'job_portal'
        """
    )
