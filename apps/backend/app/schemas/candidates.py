from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validators import is_valid_phone, normalize_email, normalize_phone


class CandidateListItemResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_links: Optional[dict[str, Any]] = None
    parsed_resume: Optional[dict[str, Any]] = None
    source: Optional[str] = None
    tags: list[str] = []
    status: str
    job_id: Optional[UUID] = None
    job_title: Optional[str] = None
    stage_id: Optional[UUID] = None
    stage_name: Optional[str] = None
    is_pending_duplicate_review: bool = False
    possible_duplicate_of_id: Optional[UUID] = None
    assignments: list["CandidateAssignmentItemResponse"] = []
    created_at: datetime
    updated_at: datetime


class CandidateDetailResponse(CandidateListItemResponse):
    pass


class CandidateAssignmentItemResponse(BaseModel):
    assigned_id: UUID
    job_id: UUID
    job_title: Optional[str] = None
    stage_id: Optional[UUID] = None
    stage_name: Optional[str] = None
    assignment_status: str
    source: Optional[str] = None
    applied_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CandidateJobScoreResponse(BaseModel):
    total_score: int | None = None
    status: str | None = None
    sections: dict[str, Any] = Field(default_factory=dict)


class CandidateCreateRequest(BaseModel):
    job_id: Optional[UUID] = None
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_links: dict[str, str] = {}
    stage_id: Optional[UUID] = None
    source: Optional[str] = Field(default="Manual", max_length=100)
    tags: list[str] = []
    status: str = Field(default="active", pattern=r"^(active|rejected|hired)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: EmailStr) -> str:
        return normalize_email(value)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        normalized = normalize_phone(value)
        if normalized is None:
            return None
        if not is_valid_phone(normalized):
            raise ValueError("Invalid phone number format")
        return normalized


class CandidateStageUpdateRequest(BaseModel):
    stage_id: UUID
    job_id: Optional[UUID] = None


class CandidateStatusUpdateRequest(BaseModel):
    status: str = Field(pattern=r"^(active|rejected|hired)$")
    job_id: Optional[UUID] = None


class CandidateUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_links: Optional[dict[str, str]] = None
    job_id: Optional[UUID] = None
    clear_job: bool = False

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        if value is None:
            return None
        return normalize_email(value)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        normalized = normalize_phone(value)
        if normalized is None:
            return None
        if not is_valid_phone(normalized):
            raise ValueError("Invalid phone number format")
        return normalized


class CandidateListResponse(BaseModel):
    items: list[CandidateListItemResponse]
    total: int
    limit: int
    offset: int


class CandidateStageFilterOptionsResponse(BaseModel):
    """Ordered hiring stage filter labels (stage union + terminal statuses when applicable)."""

    names: list[str]


class CandidateBulkStageUpdateRequest(BaseModel):
    candidate_ids: list[UUID] = Field(min_length=1)
    stage_id: UUID


class CandidateBulkStatusUpdateRequest(BaseModel):
    candidate_ids: list[UUID] = Field(min_length=1)
    status: str = Field(pattern=r"^(active|rejected|hired)$")


class CandidateBulkAssignJobRequest(BaseModel):
    candidate_ids: list[UUID] = Field(min_length=1)
    job_id: UUID


class CandidateBulkUpdateResponse(BaseModel):
    updated_count: int


class CandidateCsvImportError(BaseModel):
    row: int
    reason: str


class CandidateCsvImportResponse(BaseModel):
    total_rows: int
    created_count: int
    failed_count: int
    errors: list[CandidateCsvImportError] = []


class CandidateNoteRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    mentions: list[UUID] = []


class CandidateNoteMentionResponse(BaseModel):
    user_id: UUID
    name: Optional[str] = None
    email: str


class CandidateNoteResponse(BaseModel):
    id: UUID
    author_user_id: UUID
    author_name: Optional[str] = None
    content: str
    mentions: list[CandidateNoteMentionResponse] = []
    created_at: datetime


class CandidateActivityResponse(BaseModel):
    id: UUID
    type: str
    metadata: dict = {}
    created_by_user_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime


class CandidateOverviewResponse(BaseModel):
    notes: list[CandidateNoteResponse] = []
    activities: list[CandidateActivityResponse] = []


class CandidateInterviewCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=480)
    meeting_link: Optional[str] = None
    interviewer_ids: list[UUID] = []


class CandidateInterviewResponse(BaseModel):
    id: UUID
    title: str
    scheduled_at: datetime
    duration_minutes: Optional[int] = None
    meeting_link: Optional[str] = None
    interviewer_ids: list[UUID] = []
    created_at: datetime
    updated_at: datetime


class CandidateFeedbackCreateRequest(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    decision: str = Field(pattern=r"^(yes|no|maybe)$")
    comments: Optional[str] = None


class CandidateFeedbackResponse(BaseModel):
    id: UUID
    interview_id: UUID
    reviewer_user_id: UUID
    reviewer_name: Optional[str] = None
    rating: Optional[int] = None
    decision: str
    comments: Optional[str] = None
    created_at: datetime


class CandidateEvaluationResponse(BaseModel):
    average_rating: float = 0.0
    counts: dict[str, int] = {}
    feedback: list[CandidateFeedbackResponse] = []


class CandidateDocumentResponse(BaseModel):
    id: UUID
    field_key: str
    name: str
    url: str
    object_key: str
    mime_type: str
    size_bytes: int
    doc_type: str
    size_label: Optional[str] = None
    created_by_user_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime


class CandidateApplicationResponseFile(BaseModel):
    name: str
    url: str


class CandidateApplicationResponseItem(BaseModel):
    key: str
    label: str
    type: str
    required: bool = False
    response: str | int | float | bool | list[str] | None = None
    files: list[CandidateApplicationResponseFile] = []


class CandidateApplicationResponsesResponse(BaseModel):
    submitted_at: datetime | None = None
    has_additional_questions: bool = False
    items: list[CandidateApplicationResponseItem] = []
