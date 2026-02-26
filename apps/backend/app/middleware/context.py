from typing import Optional
from uuid import UUID

from fastapi import Header, Request

from app.core.logging import logger
from app.schemas.common import RequestContextSchema, UserContext


class RequestContext:
    def __init__(self, org_id: Optional[UUID] = None, user: Optional[UserContext] = None):
        self.org_id = org_id
        self.user = user or UserContext()

    def to_schema(self) -> RequestContextSchema:
        return RequestContextSchema(org_id=self.org_id, user=self.user)


async def get_request_context(
    request: Request,
    x_org_id: Optional[str] = Header(None, alias="X-ORG-ID"),
    authorization: Optional[str] = Header(None),
) -> RequestContext:
    org_id = None
    if x_org_id:
        try:
            org_id = UUID(x_org_id)
        except ValueError:
            logger.warning(f"Invalid X-ORG-ID header: {x_org_id}")

    user = UserContext()
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        logger.debug(f"Token received (length: {len(token)})")
        # Stub: In production, verify token and populate user from DB

    ctx = RequestContext(org_id=org_id, user=user)
    request.state.context = ctx
    return ctx
