from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------


class MessageAttachment(BaseModel):
    s3_key: str
    filename: str
    mime_type: str
    size: int


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
    body_visible: str | None = None
    body_quoted: str | None = None
    html_body: str | None = None
    status: str
    provider_message_id: str | None = None
    email_message_id: str | None = None
    in_reply_to: str | None = None
    created_at: datetime
    attachments: list[MessageAttachment] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    body: str = Field(default="")
    html_body: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)

    @model_validator(mode="after")
    def body_or_attachments_required(self):
        if not self.body.strip() and not self.attachments:
            raise ValueError("body or at least one attachment is required")
        return self


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------


class CandidateSnippet(BaseModel):
    id: UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


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
    body: str = Field(default="")
    html_body: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)

    @model_validator(mode="after")
    def body_or_attachments_required(self):
        if not self.body.strip() and not self.attachments:
            raise ValueError("body or at least one attachment is required")
        return self
