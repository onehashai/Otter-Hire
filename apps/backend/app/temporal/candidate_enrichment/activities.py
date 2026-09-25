"""Activities for candidate profile enrichment."""

from __future__ import annotations

from uuid import UUID

from temporalio import activity

from app.services.avatar_service import enrich_candidate_profile_and_avatar
from app.temporal.candidate_enrichment.types import CandidateEnrichmentInput


@activity.defn(name="enrich_candidate_profile_activity")
async def enrich_candidate_profile_activity(input_data: CandidateEnrichmentInput) -> dict:
    return await enrich_candidate_profile_and_avatar(
        org_id=UUID(input_data.org_id),
        candidate_id=UUID(input_data.candidate_id),
        force_avatar_refresh=input_data.force_avatar_refresh,
    )
