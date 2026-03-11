"""seed default templates for existing orgs

Revision ID: g3c4d5e6f7a8
Revises: f2b3c4d5e6f7
Create Date: 2026-03-11

For each organization that has no templates, insert the 8 default templates.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "g3c4d5e6f7a8"
down_revision: Union[str, None] = "f2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Default templates (name, subject, body) — keep in sync with app.templates.defaults
DEFAULT_TEMPLATES = [
    (
        "Application Received",
        "We received your application for {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>Thank you for applying for <strong>{{job_title}}</strong> at {{company_name}}. We've received your application and our team will review it shortly.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Interview Invitation",
        "Interview Invitation — {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>We'd like to invite you for an interview for the <strong>{{job_title}}</strong> position.</p><p><strong>Date:</strong> {{interview_date}}<br/><strong>Interviewer:</strong> {{interviewer_name}}</p><p>Please confirm your availability.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Interview Confirmation",
        "Interview confirmed — {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>This confirms your interview for the <strong>{{job_title}}</strong> position on {{interview_date}} with {{interviewer_name}}.</p><p>We look forward to speaking with you.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Interview Reminder",
        "Reminder: Upcoming Interview for {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>This is a friendly reminder about your upcoming interview for <strong>{{job_title}}</strong> on {{interview_date}} with {{interviewer_name}}.</p><p>Good luck!</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Candidate Rejection",
        "Update on your application — {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>Thank you for your interest in the <strong>{{job_title}}</strong> position at {{company_name}}. After careful consideration, we've decided to move forward with other candidates.</p><p>We appreciate your time and wish you the best in your job search.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Send Offer Letter",
        "Offer of Employment — {{job_title}} at {{company_name}}",
        "<p>Hi {{candidate_name}},</p><p>We are pleased to extend an offer of employment for the position of <strong>{{job_title}}</strong> at {{company_name}}.</p><p>Please review the attached offer letter and let us know if you have any questions. We look forward to welcoming you to the team.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Interview Feedback Request",
        "Quick feedback — your interview for {{job_title}}",
        "<p>Hi {{candidate_name}},</p><p>Thank you for interviewing with us for the <strong>{{job_title}}</strong> position. We'd love to hear about your experience. If you have a moment, please share your feedback so we can continue to improve.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
    (
        "Candidate Follow-up",
        "Following up — {{job_title}} at {{company_name}}",
        "<p>Hi {{candidate_name}},</p><p>I wanted to follow up on your application for the <strong>{{job_title}}</strong> position. We're still reviewing candidates and will be in touch with next steps soon.</p><p>Thank you for your patience.</p><p>Best regards,<br/>The {{company_name}} Team</p>",
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    orgs = conn.execute(sa.text("SELECT id FROM organizations")).fetchall()
    for (org_id,) in orgs:
        count = conn.execute(
            sa.text("SELECT COUNT(*) FROM templates WHERE org_id = :org_id"),
            {"org_id": org_id},
        ).scalar()
        if count and count > 0:
            continue
        for name, subject, body in DEFAULT_TEMPLATES:
            conn.execute(
                sa.text("""
                    INSERT INTO templates (id, org_id, name, category, subject, body, created_at, updated_at)
                    VALUES (gen_random_uuid(), :org_id, :name, 'Email', :subject, :body, NOW(), NOW())
                """),
                {"org_id": org_id, "name": name, "subject": subject, "body": body},
            )


def downgrade() -> None:
    # Remove only default-named templates (by name match)
    conn = op.get_bind()
    default_names = [t[0] for t in DEFAULT_TEMPLATES]
    for name in default_names:
        conn.execute(
            sa.text("DELETE FROM templates WHERE name = :name"),
            {"name": name},
        )
