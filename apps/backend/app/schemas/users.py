from uuid import UUID
from typing import Optional
from enum import Enum

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

    model_config = {"from_attributes": True}


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
