"""add_candidate_moved_stage_automations

Revision ID: c18b5ba07caa
Revises: c80a39c27133
Create Date: 2026-03-20 17:09:33.718544

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c18b5ba07caa'
down_revision: Union[str, None] = 'c80a39c27133'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Get all orgs
    orgs = conn.execute(sa.text("SELECT id FROM organizations")).fetchall()
    
    for org_row in orgs:
        org_id = org_row[0]
        
        # Get template IDs for this org
        interview_template = conn.execute(
            sa.text("SELECT id FROM templates WHERE org_id = :org_id AND name = 'Interview Invitation'"),
            {"org_id": org_id}
        ).fetchone()
        
        rejection_template = conn.execute(
            sa.text("SELECT id FROM templates WHERE org_id = :org_id AND name = 'Candidate Rejection'"),
            {"org_id": org_id}
        ).fetchone()
        
        offer_template = conn.execute(
            sa.text("SELECT id FROM templates WHERE org_id = :org_id AND name = 'Send Offer Letter'"),
            {"org_id": org_id}
        ).fetchone()
        
        # Get a user from this org for created_by_user_id
        user = conn.execute(
            sa.text("SELECT id FROM users WHERE org_id = :org_id LIMIT 1"),
            {"org_id": org_id}
        ).fetchone()
        
        if not user:
            continue
        
        user_id = user[0]
        
        # 1. Interview Invitation automation
        if interview_template:
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
                    "name": "Interview Invitation",
                    "status": "active",
                    "scope": "all",
                    "trigger_type": "candidate",
                    "trigger_key": "candidate_moved",
                    "trigger_config": '{"label": "Candidate moved to Interview", "stage": "Interview"}',
                    "condition_logic": "and",
                    "conditions": '[]',
                    "actions": f'[{{"type": "send_email", "config": {{"template": "{interview_template[0]}"}}, "label": "Send Interview Invitation"}}]',
                    "description": "Send interview invite when candidate moves to Interview stage"
                }
            )
        
        # 2. Rejection Email automation
        if rejection_template:
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
                    "name": "Rejection Email",
                    "status": "active",
                    "scope": "all",
                    "trigger_type": "candidate",
                    "trigger_key": "candidate_moved",
                    "trigger_config": '{"label": "Candidate moved to Rejected", "stage": "Rejected"}',
                    "condition_logic": "and",
                    "conditions": '[]',
                    "actions": f'[{{"type": "send_email", "config": {{"template": "{rejection_template[0]}"}}, "label": "Send Candidate Rejection"}}]',
                    "description": "Send rejection email when candidate moves to Rejected stage"
                }
            )
        
        # 3. Hiring Congratulations automation
        if offer_template:
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
                    "name": "Hiring Congratulations",
                    "status": "active",
                    "scope": "all",
                    "trigger_type": "candidate",
                    "trigger_key": "candidate_moved",
                    "trigger_config": '{"label": "Candidate moved to Hired", "stage": "Hired"}',
                    "condition_logic": "and",
                    "conditions": '[]',
                    "actions": f'[{{"type": "send_email", "config": {{"template": "{offer_template[0]}"}}, "label": "Send Offer Letter"}}]',
                    "description": "Send offer/hired confirmation when candidate moves to Hired stage"
                }
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            DELETE FROM automations 
            WHERE trigger_key = 'candidate_moved' 
            AND name IN ('Interview Invitation', 'Rejection Email', 'Hiring Congratulations')
        """)
    )
