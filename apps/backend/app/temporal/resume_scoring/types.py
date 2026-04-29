from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ResumeScoreInput:
    org_id: str
    candidate_id: str
    job_id: str
    generation: int
