"""rename candidate_documents table to documents

Revision ID: v1w2x3y4z5a6
Revises: u1v2w3x4y5z6
Create Date: 2026-03-30 18:35:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v1w2x3y4z5a6"
down_revision: Union[str, Sequence[str], None] = "u1v2w3x4y5z6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_documents')")
    )
    candidate_documents_exists = result.scalar()
    
    result = conn.execute(
        text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documents')")
    )
    documents_exists = result.scalar()
    
    if candidate_documents_exists and not documents_exists:
        op.rename_table("candidate_documents", "documents")
        op.execute(
            "ALTER INDEX IF EXISTS ix_candidate_documents_org_candidate_created "
            "RENAME TO ix_documents_org_candidate_created"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_candidate_documents_org_job_field "
            "RENAME TO ix_documents_org_job_field"
        )
        op.execute(
            "ALTER INDEX IF EXISTS ix_candidate_documents_org_uploaded_by "
            "RENAME TO ix_documents_org_uploaded_by"
        )


def downgrade() -> None:
    op.rename_table("documents", "candidate_documents")
    op.execute(
        "ALTER INDEX IF EXISTS ix_documents_org_candidate_created "
        "RENAME TO ix_candidate_documents_org_candidate_created"
    )
    op.execute(
        "ALTER INDEX IF EXISTS ix_documents_org_job_field "
        "RENAME TO ix_candidate_documents_org_job_field"
    )
    op.execute(
        "ALTER INDEX IF EXISTS ix_documents_org_uploaded_by "
        "RENAME TO ix_candidate_documents_org_uploaded_by"
    )
