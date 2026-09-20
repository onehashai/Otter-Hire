from __future__ import annotations

from app.services.migration.config_loader import ConnectorConfig

BRIDGE_PROVIDERS = {
    "bamboohr",
    "greenhouse",
    "lever",
    "smartrecruiters",
    "workable",
}

_ENTITY_ENDPOINTS = {
    "list_jobs": {"jobs"},
    "list_stages": {"stages", "application_stages"},
    "list_candidates": {"candidates", "candidate_details"},
    "list_applications": {"applications", "application_details"},
    "list_resumes": {"resumes"},
    "list_interviews": {"interviews"},
    "list_notes": {"notes"},
}


def bridge_tools_for(config: ConnectorConfig) -> list[str]:
    """Expose a stable, read-only tool contract over provider REST endpoints."""
    endpoint_names = set(config.endpoints)
    return [
        tool_name
        for tool_name, required_endpoints in _ENTITY_ENDPOINTS.items()
        if endpoint_names.intersection(required_endpoints)
    ]
