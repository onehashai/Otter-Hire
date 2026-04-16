"""
Default automations created for every organization on signup or when creating a new org.
Links to default email templates (Application Received, Interview Invitation, etc.).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import Automation
from app.models.template import Template

# Template name -> automation config
# Each automation links to a template by name (looked up per org)
DEFAULT_AUTOMATIONS = [
    {
        "name": "Application Confirmation",
        "description": "Send confirmation email when a candidate applies",
        "trigger_type": "candidate",
        "trigger_key": "candidate_applied",
        "trigger_config": {"label": "Candidate applied"},
        "conditions": [],
        "template_name": "Application Received",
        "action_type": "send_email",
    },
    # TODO: Re-enable when Interview Invitation default template is restored in org bootstrap.
    # {
    #     "name": "Interview Invitation",
    #     "description": "Send interview invite when candidate moves to Interview stage",
    #     "trigger_type": "candidate",
    #     "trigger_key": "candidate_moved",
    #     "trigger_config": {"label": "Candidate moved to Interview", "stage": "Interview"},
    #     "conditions": [],
    #     "template_name": "Interview Invitation",
    #     "action_type": "send_email",
    # },
    {
        "name": "Rejection Email",
        "description": "Send rejection email when candidate moves to Rejected stage",
        "trigger_type": "candidate",
        "trigger_key": "candidate_moved",
        "trigger_config": {"label": "Candidate moved to Rejected", "stage": "Rejected"},
        "conditions": [],
        "template_name": "Candidate Rejection",
        "action_type": "send_email",
    },
    {
        "name": "Hiring Congratulations",
        "description": "Send offer/hired confirmation when candidate moves to Hired stage",
        "trigger_type": "candidate",
        "trigger_key": "candidate_moved",
        "trigger_config": {"label": "Candidate moved to Hired", "stage": "Hired"},
        "conditions": [],
        "template_name": "Send Offer Letter",
        "action_type": "send_email",
    },
]


async def create_default_automations_for_org(
    session: AsyncSession, org_id, created_by_user_id
) -> None:
    """
    Add the default automations for an organization, linked to default templates.
    Call this after creating a new org (signup, create_organization, OAuth).
    Requires templates to exist (call create_default_templates_for_org + flush first).
    """
    template_names = [a["template_name"] for a in DEFAULT_AUTOMATIONS]
    result = await session.execute(
        select(Template).where(
            Template.org_id == org_id,
            Template.name.in_(template_names),
        )
    )
    templates_by_name = {t.name: t for t in result.scalars().all()}

    for cfg in DEFAULT_AUTOMATIONS:
        template = templates_by_name.get(cfg["template_name"])
        if template is None:
            continue

        action_config = {"template": str(template.id)}
        actions = [
            {
                "type": cfg["action_type"],
                "config": action_config,
                "label": f"Send {cfg['template_name']}",
            }
        ]

        session.add(
            Automation(
                org_id=org_id,
                created_by_user_id=created_by_user_id,
                name=cfg["name"],
                status="active",
                scope="all",
                trigger_type=cfg["trigger_type"],
                trigger_key=cfg["trigger_key"],
                trigger_config=cfg["trigger_config"],
                condition_logic="and",
                conditions=cfg["conditions"],
                actions=actions,
                description=cfg["description"],
            )
        )
