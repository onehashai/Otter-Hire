from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    role: str
    org_id: UUID
    is_verified: bool
    is_onboarded: bool


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyEmailResponse(BaseModel):
    ok: bool


class OnboardingRequest(BaseModel):
    full_name: str = Field(min_length=1)
    organization_name: str = Field(min_length=1)
