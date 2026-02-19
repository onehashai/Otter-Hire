from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HiringStageRequest(BaseModel):
    id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=100)
    position: int = Field(ge=0)


class HiringStageResponse(BaseModel):
    id: UUID
    name: str
    position: int


class TeamMemberRequest(BaseModel):
    user_id: UUID
    role: str = Field(pattern=r"^(hiring_manager|recruiter|interviewer|coordinator)$")


class TeamMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: Optional[str] = None
    email: Optional[str] = None
    role: str


class JobCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class JobUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    department: Optional[str] = Field(default=None, max_length=50)
    employment_type: Optional[str] = Field(default=None, pattern=r"^(full_time|part_time|contract|internship)$")
    workplace_type: Optional[str] = Field(default=None, pattern=r"^(remote|hybrid|onsite)$")
    country: Optional[str] = Field(default=None, max_length=2)
    city: Optional[str] = Field(default=None, max_length=255)
    openings: Optional[int] = Field(default=None, ge=1)
    salary_type: Optional[str] = Field(default=None, pattern=r"^(hidden|fixed|range)$")
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_fixed: Optional[int] = None
    currency: Optional[str] = Field(default=None, max_length=3)
    salary_timeframe: Optional[str] = Field(default=None, pattern=r"^(per_year|per_month|per_week|per_day|per_hour)$")
    description: Optional[str] = None
    visibility: Optional[str] = Field(default=None, pattern=r"^(internal|careers|public)$")
    collect_resume: Optional[bool] = None
    collect_cover: Optional[bool] = None
    screening_questions: Optional[list[str]] = None
    pipeline_template: Optional[str] = Field(default=None, max_length=20)
    hiring_stages: Optional[list[HiringStageRequest]] = None
    team_members: Optional[list[TeamMemberRequest]] = None


class JobListItemResponse(BaseModel):
    id: UUID
    title: str
    department: Optional[str] = None
    employment_type: Optional[str] = None
    status: str
    candidate_count: int = 0
    created_at: datetime
    updated_at: datetime


class JobDetailResponse(BaseModel):
    id: UUID
    title: str
    department: Optional[str] = None
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
    description: Optional[str] = None
    status: str
    visibility: str
    collect_resume: bool
    collect_cover: bool
    screening_questions: list[str] = []
    pipeline_template: Optional[str] = None
    hiring_stages: list[HiringStageResponse] = []
    team_members: list[TeamMemberResponse] = []
    created_by_user_id: UUID
    published_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime