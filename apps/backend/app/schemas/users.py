from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class AssignableRole(str, Enum):
    admin = "admin"
    recruiter = "recruiter"
    hiring_manager = "hiring_manager"
    interviewer = "interviewer"
    employee = "employee"


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: str
    status: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfileResponse(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: str


class UserPreferencesResponse(BaseModel):
    preferences: dict[str, Any] = {}


class UserPreferencesPatchRequest(BaseModel):
    preferences: dict[str, Any]


class InviteUserRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: AssignableRole = AssignableRole.employee

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UpdateUserRoleRequest(BaseModel):
    role: AssignableRole


class SecurityStatusResponse(BaseModel):
    auth_provider: str  # email | google | email,google | google,email
    has_password: bool
    google_connected: bool


class CreatePasswordRequest(BaseModel):
    """For Google-first users who have no password yet."""

    new_password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class UpdatePasswordRequest(BaseModel):
    """For users who already have a password."""

    current_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)
