"""Input types for job-apply resume parsing Temporal workflows."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class JobApplyResumeParseInput:
    org_id: str
    candidate_id: str
    object_key: str
    resume_display_name: str
    mime: str
    fallback_email: str
