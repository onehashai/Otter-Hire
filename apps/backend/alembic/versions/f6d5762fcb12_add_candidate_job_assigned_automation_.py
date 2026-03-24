"""add_candidate_job_assigned_automation_and_template

Revision ID: f6d5762fcb12
Revises: f8g9h0i1j2k3
Create Date: 2026-03-20 12:39:45.501977

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f6d5762fcb12'
down_revision: Union[str, None] = 'f8g9h0i1j2k3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add email template and automation rule for candidate_job_assigned trigger.
    This allows sending emails when talent pool candidates are assigned to jobs.
    """
    conn = op.get_bind()
    
    # Get the first organization for seeding
    org_result = conn.execute(sa.text(
        "SELECT id FROM organizations ORDER BY created_at LIMIT 1"
    )).fetchone()
    
    if not org_result:
        # No organizations exist, skip seeding
        return
    
    org_id = org_result[0]
    
    # Create email template for job assignment
    template_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    
    conn.execute(sa.text("""
        INSERT INTO templates (
            id, org_id, name, category, subject, body, created_at, updated_at
        ) VALUES (
            :template_id,
            :org_id,
            'Job Assignment Notification',
            'Email',
            'New Opportunity: {{job_title}}',
            '<p>Hi {{candidate_name}},</p><p>Great news! We are considering you for the <strong>{{job_title}}</strong> position at {{company_name}}.</p><p>We reviewed your profile and believe you could be a great fit for this role. Our team will be in touch soon with next steps.</p><p>Best regards,<br/>The {{company_name}} Team</p>',
            :now,
            :now
        )
    """), {
        "template_id": template_id,
        "org_id": org_id,
        "now": now
    })
    
    # Get a user for automation created_by_user_id
    user_result = conn.execute(sa.text(
        "SELECT id FROM users WHERE org_id = :org_id ORDER BY created_at LIMIT 1"
    ), {"org_id": org_id}).fetchone()
    
    if not user_result:
        # No users exist, skip seeding
        return
    
    user_id = user_result[0]
    
    # Create automation rule for candidate_job_assigned trigger
    automation_id = uuid.uuid4()
    
    conn.execute(sa.text("""
        INSERT INTO automations (
            id, org_id, created_by_user_id, name, status, scope, 
            trigger_type, trigger_key, trigger_config, condition_logic, 
            conditions, actions, description, execution_count, created_at, updated_at
        ) VALUES (
            :automation_id,
            :org_id,
            :user_id,
            'Job Assignment Email',
            'active',
            'all',
            'event',
            'candidate_job_assigned',
            '{}',
            'and',
            '[]',
            :actions,
            'Automatically send email when a talent pool candidate is assigned to a job',
            0,
            :now,
            :now
        )
    """), {
        "automation_id": automation_id,
        "org_id": org_id,
        "user_id": user_id,
        "actions": f'[{{"type": "send_email", "config": {{"template": "{template_id}"}}}}]',
        "now": now
    })
    
    print(f"✅ Created email template: {template_id}")
    print(f"✅ Created automation rule: {automation_id}")
    print("✅ Trigger: candidate_job_assigned")


def downgrade() -> None:
    """
    Remove the candidate_job_assigned automation and template.
    """
    conn = op.get_bind()
    
    # Delete automation rule
    conn.execute(sa.text("""
        DELETE FROM automations 
        WHERE trigger_key = 'candidate_job_assigned'
    """))
    
    # Delete email template
    conn.execute(sa.text("""
        DELETE FROM templates 
        WHERE name = 'Job Assignment Notification'
    """))
    
    print("✅ Removed candidate_job_assigned automation and template")
