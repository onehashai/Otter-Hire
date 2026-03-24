"""seed default categories for existing orgs

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2025-01-10 13:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "k6l7m8n9o0p1"
down_revision: Union[str, None] = "j5k6l7m8n9o0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Get all existing organizations
    orgs = conn.execute(sa.text("SELECT id FROM organizations")).fetchall()

    default_categories = ["Engineering", "Design", "Marketing", "Sales", "Data", "Operations", "HR"]

    for org in orgs:
        org_id = org[0]
        for cat_name in default_categories:
            # Check if category already exists
            existing = conn.execute(
                sa.text("SELECT id FROM job_categories WHERE org_id = :org_id AND name = :name"),
                {"org_id": org_id, "name": cat_name},
            ).fetchone()

            if not existing:
                # Insert default category
                conn.execute(
                    sa.text("""
                        INSERT INTO job_categories (id, org_id, name, is_system_default, created_at)
                        VALUES (gen_random_uuid(), :org_id, :name, true, NOW())
                    """),
                    {"org_id": org_id, "name": cat_name},
                )


def downgrade() -> None:
    # Remove all system default categories
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM job_categories WHERE is_system_default = true"))
