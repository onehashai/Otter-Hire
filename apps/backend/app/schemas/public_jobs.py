from pydantic import BaseModel
from datetime import datetime


class PublicJobListItem(BaseModel):
    id: str
    title: str
    description: str | None
    department: str | None
    employment_type: str | None
    workplace_type: str | None
    location: str | None
    salary_min: int | None
    salary_max: int | None
    salary_fixed: int | None
    currency: str
    salary_timeframe: str
    published_at: datetime
    status: str

    class Config:
        from_attributes = True


class PublicJobDetail(BaseModel):
    id: str
    title: str
    description: str | None
    department: str | None
    employment_type: str | None
    workplace_type: str | None
    country: str | None
    city: str | None
    salary_min: int | None
    salary_max: int | None
    salary_fixed: int | None
    currency: str
    salary_timeframe: str
    published_at: datetime
    org_name: str
    status: str

    class Config:
        from_attributes = True
