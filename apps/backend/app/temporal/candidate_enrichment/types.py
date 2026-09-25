"""Input for the non-blocking candidate profile enrichment workflow."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CandidateEnrichmentInput:
    org_id: str
    candidate_id: str
    force_avatar_refresh: bool = False
