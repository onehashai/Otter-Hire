"""add rejected stage to all jobs

Revision ID: c9d0e1f2a3b4
Revises: a1b2c3d4e5f7
Create Date: 2026-03-26 16:40:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    jobs = conn.execute(sa.text("SELECT id, org_id FROM jobs")).mappings().all()

    for job in jobs:
        job_id = job["id"]
        org_id = job["org_id"]
        rows = (
            conn.execute(
                sa.text(
                    """
                SELECT id, name, position, is_required
                FROM stages
                WHERE job_id = :job_id
                ORDER BY position ASC, created_at ASC
                """
                ),
                {"job_id": job_id},
            )
            .mappings()
            .all()
        )
        if not rows:
            continue

        applied = next((r for r in rows if (r["name"] or "").strip().lower() == "applied"), None)
        hired = next((r for r in rows if (r["name"] or "").strip().lower() == "hired"), None)
        rejected = next((r for r in rows if (r["name"] or "").strip().lower() == "rejected"), None)

        if applied is None:
            applied_id = uuid4()
            next_position = conn.execute(
                sa.text(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM stages WHERE job_id = :job_id"
                ),
                {"job_id": job_id},
            ).scalar_one()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO stages (id, org_id, job_id, name, position, is_required)
                    VALUES (:id, :org_id, :job_id, 'Applied', :position, true)
                    """
                ),
                {"id": applied_id, "org_id": org_id, "job_id": job_id, "position": next_position},
            )
            applied = {"id": applied_id, "name": "Applied"}

        if hired is None:
            hired_id = uuid4()
            next_position = conn.execute(
                sa.text(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM stages WHERE job_id = :job_id"
                ),
                {"job_id": job_id},
            ).scalar_one()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO stages (id, org_id, job_id, name, position, is_required)
                    VALUES (:id, :org_id, :job_id, 'Hired', :position, true)
                    """
                ),
                {"id": hired_id, "org_id": org_id, "job_id": job_id, "position": next_position},
            )
            hired = {"id": hired_id, "name": "Hired"}

        if rejected is None:
            rejected_id = uuid4()
            next_position = conn.execute(
                sa.text(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM stages WHERE job_id = :job_id"
                ),
                {"job_id": job_id},
            ).scalar_one()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO stages (id, org_id, job_id, name, position, is_required)
                    VALUES (:id, :org_id, :job_id, 'Rejected', :position, true)
                    """
                ),
                {"id": rejected_id, "org_id": org_id, "job_id": job_id, "position": next_position},
            )
            rejected = {"id": rejected_id, "name": "Rejected"}

        rows = (
            conn.execute(
                sa.text(
                    """
                SELECT id, name, position
                FROM stages
                WHERE job_id = :job_id
                ORDER BY position ASC, created_at ASC
                """
                ),
                {"job_id": job_id},
            )
            .mappings()
            .all()
        )

        required_ids = {
            str(applied["id"]),
            str(hired["id"]),
            str(rejected["id"]),
        }
        custom_rows = [r for r in rows if str(r["id"]) not in required_ids]
        ordered_ids = [applied["id"], *[r["id"] for r in custom_rows], hired["id"], rejected["id"]]

        conn.execute(
            sa.text("UPDATE stages SET position = position + 1000 WHERE job_id = :job_id"),
            {"job_id": job_id},
        )
        for idx, stage_id in enumerate(ordered_ids):
            conn.execute(
                sa.text("UPDATE stages SET position = :position WHERE id = :id"),
                {"position": idx, "id": stage_id},
            )

        conn.execute(
            sa.text(
                """
                UPDATE stages
                SET is_required = CASE
                    WHEN lower(name) IN ('applied', 'hired', 'rejected') THEN true
                    ELSE is_required
                END
                WHERE job_id = :job_id
                """
            ),
            {"job_id": job_id},
        )

        conn.execute(
            sa.text(
                """
                UPDATE candidates
                SET stage_id = :rejected_stage_id
                WHERE job_id = :job_id AND status = 'rejected'
                """
            ),
            {"job_id": job_id, "rejected_stage_id": rejected["id"]},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE stages
            SET is_required = false
            WHERE lower(name) = 'rejected'
            """
        )
    )
