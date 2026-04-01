from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

JobDescriptionAiAction = Literal[
    "generate_full",
    "improve_tone",
    "shorten",
    "expand",
    "add_responsibilities",
    "add_requirements",
]


class JobDescriptionAiRequest(BaseModel):
    action: JobDescriptionAiAction
    current_html: str = ""


class JobDescriptionAiResponse(BaseModel):
    html: str


class HiringStageRequest(BaseModel):
    id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=100)
    position: int = Field(ge=0)


class HiringStageResponse(BaseModel):
    id: UUID
    name: str
    position: int
    is_required: bool = False


class TeamMemberRequest(BaseModel):
    user_id: UUID
    role: str = Field(pattern=r"^(hiring_manager|recruiter|interviewer|coordinator)$")


class TeamMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: Optional[str] = None
    email: Optional[str] = None
    role: str
    user_role: Optional[str] = None


class JobCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class JobUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)
    employment_type: Optional[str] = Field(
        default=None, pattern=r"^(full_time|part_time|contract|internship)$"
    )
    workplace_type: Optional[str] = Field(default=None, pattern=r"^(remote|hybrid|onsite)$")
    country: Optional[str] = Field(default=None, max_length=2)
    city: Optional[str] = Field(default=None, max_length=255)
    openings: Optional[int] = Field(default=None, ge=1)
    salary_type: Optional[str] = Field(default=None, pattern=r"^(hidden|fixed|range)$")
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_fixed: Optional[int] = None
    currency: Optional[str] = Field(default=None, max_length=3)
    salary_timeframe: Optional[str] = Field(
        default=None, pattern=r"^(per_year|per_month|per_week|per_day|per_hour)$"
    )
    post_to_linkedin: Optional[bool] = None
    description: Optional[str] = None
    collect_resume: Optional[bool] = None
    collect_cover: Optional[bool] = None
    screening_questions: Optional[list[str]] = None
    application_form_schema: Optional[dict[str, Any]] = None
    hiring_stages: Optional[list[HiringStageRequest]] = None
    team_members: Optional[list[TeamMemberRequest]] = None


class JobListItemResponse(BaseModel):
    id: UUID
    title: str
    category: Optional[str] = None
    employment_type: Optional[str] = None
    status: str
    candidate_count: int = 0
    created_at: datetime
    updated_at: datetime


class JobDetailResponse(BaseModel):
    id: UUID
    title: str
    category: Optional[str] = None
    employment_type: Optional[str] = None
    workplace_type: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    openings: int
    salary_type: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_fixed: Optional[int] = None
    currency: Optional[str] = None
    salary_timeframe: Optional[str] = None
    post_to_linkedin: bool = False
    linkedin_sync_status: Optional[str] = None
    linkedin_external_job_id: Optional[str] = None
    linkedin_last_synced_at: Optional[datetime] = None
    linkedin_last_error: Optional[str] = None
    description: Optional[str] = None
    status: str
    visibility: str
    collect_resume: bool
    collect_cover: bool
    screening_questions: list[str] = []
    application_form_schema: dict[str, Any] = {}
    hiring_stages: list[HiringStageResponse] = []
    team_members: list[TeamMemberResponse] = []
    created_by_user_id: UUID
    published_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class JobWorkspaceCandidateResponse(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    stage_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class JobWorkspaceResponse(BaseModel):
    id: UUID
    title: str
    status: str
    stages: list[HiringStageResponse] = []
    candidates: list[JobWorkspaceCandidateResponse] = []


class JobEmailInboxResponse(BaseModel):
    job_id: UUID
    org_id: UUID
    inbox_address: str
    provider: str
    status: Literal["inactive", "pending", "active"]
    verification_status: Literal["pending", "action_required", "verified", "failed"]
    verification_provider: Optional[str] = None
    verification_action_type: Optional[str] = None
    verification_action_url: Optional[str] = None
    verification_detected_at: Optional[datetime] = None
    verification_error: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_expires_at: Optional[datetime] = None


class JobEmailConfigResponse(BaseModel):
    app_id: Literal["email_integration"] = "email_integration"
    inbox: Optional[JobEmailInboxResponse] = None
    configured: bool = False
    status: str = "not_configured"


class JobEmailConfigUpsertRequest(BaseModel):
    inbox_address: str = Field(min_length=3, max_length=320)
    provider: str = Field(default="ses", min_length=1, max_length=32)


class JobEmailActionResponse(BaseModel):
    app_id: Literal["email_integration"] = "email_integration"
    status: str
    message: str
    action_url: Optional[str] = None
