from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator, model_validator

ALLOWED_ORG_ROLES_FOR_ADMIN_UPDATE = frozenset(
    {"admin", "recruiter", "hiring_manager", "interviewer", "employee"}
)


class AdminUserMembershipRow(BaseModel):
    """One row per org membership for platform admin directory."""

    membership_id: UUID
    user_id: UUID
    email: str
    name: str
    avatar_url: str | None = None
    product_role: str
    organization_role: str
    org_id: UUID
    org_name: str
    status: str
    last_active_at: datetime | None = None


class AdminOrganizationRow(BaseModel):
    id: UUID
    name: str
    website: str | None = None
    member_count: int
    created_at: datetime


class AdminUpdateMembershipRequest(BaseModel):
    """Partial update for platform admin. Identity and platform role apply to the user; org role and status apply to this membership."""

    name: str | None = None
    email: EmailStr | None = None
    product_role: Literal["user", "admin"] | None = None
    organization_role: str | None = None
    status: Literal["pending", "active", "declined"] | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "AdminUpdateMembershipRequest":
        if not self.model_dump(exclude_none=True):
            raise ValueError("At least one field must be provided")
        return self

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        return s or None

    @field_validator("organization_role", mode="before")
    @classmethod
    def strip_org_role(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = str(v).strip().lower()
        return s or None
