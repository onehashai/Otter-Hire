"""Canonical resume profile model (schema for LLM + validation)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PersonalInfo(BaseModel):
    model_config = {"extra": "ignore"}

    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    headline: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    website_url: str | None = None


class WorkExperience(BaseModel):
    model_config = {"extra": "ignore"}

    company: str | None = None
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    location: str | None = None
    highlights: list[str] = Field(default_factory=list)


class Education(BaseModel):
    model_config = {"extra": "ignore"}

    institution: str | None = None
    degree: str | None = None
    field: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    # Grade/score — store as a free-form string to cover GPA, %, marks, letter grades
    grade_value: str | None = None
    # One of: "gpa", "percentage", "marks", "grade", or null when unknown
    grade_type: str | None = None
    # Denominator / max value (e.g. "4.0" for GPA, "100" for %)
    grade_max: str | None = None


class Skill(BaseModel):
    model_config = {"extra": "ignore"}

    name: str = ""
    category: str | None = None


class Certification(BaseModel):
    model_config = {"extra": "ignore"}

    name: str = ""
    issuer: str | None = None
    date: str | None = None


class ResumeProfile(BaseModel):
    """Canonical structured profile extracted from a resume."""

    model_config = {"extra": "ignore"}

    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: str | None = None
    work_experience: list[WorkExperience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    """Detected section headings → raw text (for debugging / re-runs)."""
    section_map: dict[str, str] = Field(default_factory=dict)
