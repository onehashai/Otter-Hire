from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    direction: str
    sender_type: str
    sender_user_id: UUID | None = None
    sender_name: str | None = None
    from_email: str
    to_email: str
    body: str
    html_body: str | None = None
    status: str
    provider_message_id: str | None = None
    email_message_id: str | None = None
    in_reply_to: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1)
    html_body: str | None = None


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------


class CandidateSnippet(BaseModel):
    id: UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class ConversationListItem(BaseModel):
    id: UUID
    subject: str
    channel: str
    status: str
    last_message_at: datetime | None = None
    created_at: datetime
    candidate: CandidateSnippet
    last_message_body: str | None = None
    message_count: int = 0

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    items: list[ConversationListItem]
    total: int
    page: int
    page_size: int


class ConversationDetail(BaseModel):
    id: UUID
    subject: str
    channel: str
    status: str
    last_message_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    candidate: CandidateSnippet
    job_id: UUID | None = None
    messages: list[MessageRead]

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    candidate_id: UUID
    job_id: UUID | None = None
    subject: str = Field(..., min_length=1, max_length=1000)
    body: str = Field(..., min_length=1)
    html_body: str | None = None
