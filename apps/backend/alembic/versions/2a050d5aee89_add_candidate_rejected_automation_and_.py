"""add_candidate_rejected_automation_and_template

Revision ID: 2a050d5aee89
Revises: c18b5ba07caa
Create Date: 2026-03-20 17:10:12.144787

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a050d5aee89'
down_revision: Union[str, None] = 'c18b5ba07caa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Get all orgs
    orgs = conn.execute(sa.text("SELECT id FROM organizations")).fetchall()
    
    for org_row in orgs:
        org_id = org_row[0]
        
        # Get existing Candidate Rejection template
        rejection_template = conn.execute(
            sa.text("SELECT id FROM templates WHERE org_id = :org_id AND name = 'Candidate Rejection'"),
            {"org_id": org_id}
        ).fetchone()
        
        if not rejection_template:
            continue
        
        template_id = rejection_template[0]
        
        # Get a user from this org for created_by_user_id
        user = conn.execute(
            sa.text("SELECT id FROM users WHERE org_id = :org_id LIMIT 1"),
            {"org_id": org_id}
        ).fetchone()
        
        if not user:
            continue
        
        user_id = user[0]
        
        # Create automation for candidate_rejected using existing template
        automation_id = uuid.uuid4()
        conn.execute(
            sa.text("""
                INSERT INTO automations (
                    id, org_id, created_by_user_id, name, status, scope,
                    trigger_type, trigger_key, trigger_config,
                    condition_logic, conditions, actions, description
                ) VALUES (
                    :id, :org_id, :user_id, :name, :status, :scope,
                    :trigger_type, :trigger_key, CAST(:trigger_config AS jsonb),
                    :condition_logic, CAST(:conditions AS jsonb), CAST(:actions AS jsonb), :description
                )
            """),
            {
                "id": automation_id,
                "org_id": org_id,
                "user_id": user_id,
                "name": "Status Rejection Notification",
                "status": "active",
                "scope": "all",
                "trigger_type": "candidate",
                "trigger_key": "candidate_rejected",
                "trigger_config": '{"label": "Candidate rejected"}',
                "condition_logic": "and",
                "conditions": '[]',
                "actions": f'[{{"type": "send_email", "config": {{"template": "{template_id}"}}, "label": "Send Candidate Rejection"}}]',
                "description": "Send rejection email when candidate status is changed to rejected"
            }
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            DELETE FROM automations 
            WHERE trigger_key = 'candidate_rejected' 
            AND name = 'Status Rejection Notification'
        """)
    )
