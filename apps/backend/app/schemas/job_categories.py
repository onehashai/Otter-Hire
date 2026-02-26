from pydantic import BaseModel, Field


class JobCategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class JobCategoryResponse(BaseModel):
    id: str
    name: str
    is_system_default: bool
    created_at: str
    usage_count: int = 0
