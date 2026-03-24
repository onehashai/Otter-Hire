"""add_candidate_email_received_automation_and_template

Revision ID: c80a39c27133
Revises: f6d5762fcb12
Create Date: 2026-03-20 14:35:39.247092

"""

from datetime import datetime, timezone
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c80a39c27133"
down_revision: Union[str, None] = "f6d5762fcb12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Get the first organization for seeding
    org_result = conn.execute(
        sa.text("SELECT id FROM organizations ORDER BY created_at LIMIT 1")
    ).fetchone()

    if not org_result:
        return

    org_id = org_result[0]

    # Create email template for email acknowledgment
    template_id = str(uuid4())
    now = datetime.now(timezone.utc)

    conn.execute(
        sa.text("""
            INSERT INTO templates (id, org_id, name, category, subject, body, created_at, updated_at)
            VALUES (
                :template_id,
                :org_id,
                'Email Acknowledgment',
                'Email',
                'Thank You for Your Email',
                '<p>Hi {{candidate_name}},</p><p>Thank you for reaching out to us. We have received your email and resume.</p><p>Our team will review your information and get back to you soon if there is a suitable opportunity.</p><p>Best regards,<br/>The {{company_name}} Team</p>',
                :now,
                :now
            )
        """),
        {"template_id": template_id, "org_id": org_id, "now": now},
    )

    # Get a user for automation created_by_user_id
    user_result = conn.execute(
        sa.text("SELECT id FROM users WHERE org_id = :org_id ORDER BY created_at LIMIT 1"),
        {"org_id": org_id},
    ).fetchone()

    if not user_result:
        return

    user_id = user_result[0]

    # Create automation rule for candidate_email_received trigger
    conn.execute(
        sa.text("""
            INSERT INTO automations (
                id, org_id, created_by_user_id, name, status, scope, 
                trigger_type, trigger_key, trigger_config, condition_logic, 
                conditions, actions, description, execution_count, created_at, updated_at
            ) VALUES (
                gen_random_uuid(),
                :org_id,
                :user_id,
                'Email Acknowledgment for Inbound Candidates',
                'active',
                'all',
                'event',
                'candidate_email_received',
                '{}'::jsonb,
                'and',
                '[]'::jsonb,
                :actions,
                'Automatically send acknowledgment email when candidate emails with resume',
                0,
                :now,
                :now
            )
        """),
        {
            "org_id": org_id,
            "user_id": user_id,
            "actions": f'[{{"type": "send_email", "config": {{"template": "{template_id}"}}}}]',
            "now": now,
        },
    )


def downgrade() -> None:
    conn = op.get_bind()

    # Remove automation rule
    conn.execute(
        sa.text("""
            DELETE FROM automations 
            WHERE trigger_key = 'candidate_email_received'
        """)
    )

    # Remove email template
    conn.execute(
        sa.text("""
            DELETE FROM templates 
            WHERE name = 'Email Acknowledgment'
        """)
    )
