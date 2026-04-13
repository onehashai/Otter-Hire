from pydantic import BaseModel, Field


class TemplateResponse(BaseModel):
    id: str
    name: str
    category: str
    subject: str
    body: str
    created_at: str
    updated_at: str


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="Email", max_length=64)
    subject: str = Field(..., min_length=1)
    body: str = Field(default="")


class TemplateUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, max_length=64)
    subject: str | None = None
    body: str | None = None
