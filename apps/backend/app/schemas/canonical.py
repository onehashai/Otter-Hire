from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validators import normalize_email, normalize_phone


class CanonicalCandidate(BaseModel):
    external_candidate_id: str | None = None
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    email: EmailStr | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    resume_text: str | None = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    job_id: UUID | None = None
    stage_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: EmailStr | None) -> str | None:
        return normalize_email(value) if value else None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else None

    @field_validator("skills", mode="before")
    @classmethod
    def normalize_skills(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = re.split(r"[,;|]", value)
        if not isinstance(value, (list, tuple, set)):
            raise ValueError("skills must be an array or a comma-separated string")
        return list(dict.fromkeys(str(item).strip() for item in value if str(item).strip()))


class CanonicalJob(BaseModel):
    external_job_id: str | None = None
    id: UUID | None = None
    title: str = Field(min_length=1, max_length=255)


class CanonicalApplication(BaseModel):
    external_application_id: str | None = None
    candidate: CanonicalCandidate
    job_id: UUID
    stage_id: UUID | None = None


class CanonicalStage(BaseModel):
    external_stage_id: str | None = None
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)


class CanonicalInterview(BaseModel):
    external_interview_id: str | None = None
    id: UUID | None = None
    candidate_id: UUID | None = None
    job_id: UUID | None = None
    title: str = Field(default="Interview", max_length=255)
    starts_at: str | None = None


class CanonicalNote(BaseModel):
    external_note_id: str | None = None
    candidate_id: UUID | None = None
    body: str = Field(min_length=1)


class ImportRowError(BaseModel):
    row: int
    message: str


class ImportSummary(BaseModel):
    total_processed: int = 0
    successful: int = 0
    failed: int = 0
    errors: list[ImportRowError] = Field(default_factory=list)
