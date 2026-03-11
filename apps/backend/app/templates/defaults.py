"""
Default email templates created for every organization on signup or when backfilling.
Each entry: (name, subject, body) with placeholders like {{candidate_name}}, {{job_title}}, etc.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DefaultTemplate:
    name: str
    subject: str
    body: str


DEFAULT_EMAIL_TEMPLATES: list[DefaultTemplate] = [
    DefaultTemplate(
        name="Application Received",
        subject="We received your application for {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>Thank you for applying for <strong>{{job_title}}</strong> at {{company_name}}. "
            "We've received your application and our team will review it shortly.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Interview Invitation",
        subject="Interview Invitation — {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>We'd like to invite you for an interview for the <strong>{{job_title}}</strong> position.</p>"
            "<p><strong>Date:</strong> {{interview_date}}<br/><strong>Interviewer:</strong> {{interviewer_name}}</p>"
            "<p>Please confirm your availability.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Interview Confirmation",
        subject="Interview confirmed — {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>This confirms your interview for the <strong>{{job_title}}</strong> position "
            "on {{interview_date}} with {{interviewer_name}}.</p>"
            "<p>We look forward to speaking with you.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Interview Reminder",
        subject="Reminder: Upcoming Interview for {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>This is a friendly reminder about your upcoming interview for <strong>{{job_title}}</strong> "
            "on {{interview_date}} with {{interviewer_name}}.</p>"
            "<p>Good luck!</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Candidate Rejection",
        subject="Update on your application — {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>Thank you for your interest in the <strong>{{job_title}}</strong> position at {{company_name}}. "
            "After careful consideration, we've decided to move forward with other candidates.</p>"
            "<p>We appreciate your time and wish you the best in your job search.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Send Offer Letter",
        subject="Offer of Employment — {{job_title}} at {{company_name}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>We are pleased to extend an offer of employment for the position of <strong>{{job_title}}</strong> "
            "at {{company_name}}.</p>"
            "<p>Please review the attached offer letter and let us know if you have any questions. "
            "We look forward to welcoming you to the team.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Interview Feedback Request",
        subject="Quick feedback — your interview for {{job_title}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>Thank you for interviewing with us for the <strong>{{job_title}}</strong> position. "
            "We'd love to hear about your experience. If you have a moment, please share your feedback "
            "so we can continue to improve.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
    DefaultTemplate(
        name="Candidate Follow-up",
        subject="Following up — {{job_title}} at {{company_name}}",
        body=(
            "<p>Hi {{candidate_name}},</p>"
            "<p>I wanted to follow up on your application for the <strong>{{job_title}}</strong> position. "
            "We're still reviewing candidates and will be in touch with next steps soon.</p>"
            "<p>Thank you for your patience.</p>"
            "<p>Best regards,<br/>The {{company_name}} Team</p>"
        ),
    ),
]


def create_default_templates_for_org(session, org_id):
    """
    Add the 8 default email templates for an organization.
    Call this after creating a new org (signup, create_organization, OAuth).
    """
    from app.models.template import Template

    for t in DEFAULT_EMAIL_TEMPLATES:
        session.add(
            Template(
                org_id=org_id,
                name=t.name,
                category="Email",
                subject=t.subject,
                body=t.body,
            )
        )
