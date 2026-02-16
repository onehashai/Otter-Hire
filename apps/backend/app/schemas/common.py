from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserContext(BaseModel):
    id: Optional[UUID] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None


class RequestContextSchema(BaseModel):
    org_id: Optional[UUID] = None
    user: UserContext


class HealthResponse(BaseModel):
    status: str
