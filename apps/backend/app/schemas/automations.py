from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class AutomationCondition(BaseModel):
    field: str
    operator: str
    value: str


class AutomationAction(BaseModel):
    type: str
    config: dict[str, Any] = Field(default_factory=dict)


class AutomationListItemResponse(BaseModel):
    id: str
    name: str
    status: str
    scope: str
    trigger_type: str
    trigger_label: str
    action_label: str
    last_run_at: datetime | None = None
    execution_count: int
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class AutomationDetailResponse(BaseModel):
    id: str
    name: str
    status: str
    scope: str
    job_id: str | None = None
    trigger_type: str
    trigger_key: str
    trigger_config: dict[str, Any]
    condition_logic: str
    conditions: list[AutomationCondition]
    actions: list[AutomationAction]
    description: str | None = None
    last_run_at: datetime | None = None
    execution_count: int
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class AutomationCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    status: str = Field(default="draft")
    scope: str = Field(default="all")
    job_id: str | None = None
    trigger_type: str
    trigger_key: str
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    condition_logic: str = Field(default="and")
    conditions: list[AutomationCondition] = Field(default_factory=list)
    actions: list[AutomationAction] = Field(default_factory=list)
    description: str | None = None

    @field_validator("job_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: str | None) -> str | None:
        if v == "" or (isinstance(v, str) and not v.strip()):
            return None
        return v


class AutomationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = None
    scope: str | None = None
    job_id: str | None = None
    trigger_type: str | None = None
    trigger_key: str | None = None
    trigger_config: dict[str, Any] | None = None
    condition_logic: str | None = None
    conditions: list[AutomationCondition] | None = None
    actions: list[AutomationAction] | None = None
    description: str | None = None


class AutomationExecutionLogEntry(BaseModel):
    id: str
    trigger_event: str
    candidate_id: str | None = None
    job_id: str | None = None
    status: str
    message: str | None = None
    created_at: datetime
