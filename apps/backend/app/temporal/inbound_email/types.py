from __future__ import annotations

from pydantic import BaseModel


class InboundEmailParseInput(BaseModel):
    inbound_email_id: str
    org_id: str
    target_job_id: str | None = None
    # Reserved for explicitly audited historical recovery batches. It must not
    # be set by the public inbound-email endpoint.
    force_contact_only: bool = False
