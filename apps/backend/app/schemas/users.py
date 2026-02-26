from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


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
