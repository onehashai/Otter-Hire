from __future__ import annotations

from pydantic import BaseModel


class InboundEmailParseInput(BaseModel):
    inbound_email_id: str
    org_id: str
    target_job_id: str | None = None
