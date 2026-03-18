"""
Default job categories created for every organization on signup or when creating a new org.
"""
from __future__ import annotations

from app.models.job_category import JobCategory

DEFAULT_JOB_CATEGORIES = [
    "Software Development",
    "Product Management",
    "Design",
    "Data Analytics",
    "Marketing",
    "Sales",
    "Customer Support",
    "Human Resources",
    "Finance",
    "Operations",
]


def create_default_job_categories_for_org(session, org_id):
    """
    Add the default job categories for an organization.
    Call this after creating a new org (signup, create_organization, OAuth).
    """
    for name in DEFAULT_JOB_CATEGORIES:
        session.add(
            JobCategory(org_id=org_id, name=name, is_system_default=True)
        )
