"""LinkedIn OAuth, Company Page configuration and verified Lead Sync webhooks."""

import asyncio
import hashlib
import hmac
import json
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.common import WorkflowIDReusePolicy
from temporalio.exceptions import WorkflowAlreadyStartedError

from app.core.config import settings
from app.core.permissions import require_permission
from app.db.session import get_db
from app.integrations.linkedin import leads, oauth, service
from app.models.org_membership import OrgMembership
from app.models.user import User
from app.schemas.integrations import IntegrationOwnerContext
from app.schemas.linkedin import CompleteLinkedInSetupRequest
from app.temporal.client import get_temporal_client
from app.temporal.linkedin import LinkedInLeadWorkflow

router = APIRouter(prefix="/integrations/linkedin", tags=["integrations"])


def _owner_ctx(user: User) -> IntegrationOwnerContext:
    return IntegrationOwnerContext(org_id=user.org_id, user_id=user.id, role=user.membership_role)


@router.get("/organizations")
async def get_linkedin_organizations(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    cred = await service.get_linkedin_credential(db, current_user.org_id)
    if not cred:
        raise HTTPException(404, "LinkedIn not connected")
    return {"organizations": await service.get_linkedin_organizations(service.credential_token(cred))}


@router.post("/complete-setup")
async def complete_linkedin_setup(request: CompleteLinkedInSetupRequest = Body(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    await service.complete_linkedin_setup(db, _owner_ctx(current_user), request.organization_id,
                                         request.organization_name, request.organization_vanity_name, request.organization_logo_url)
    return {"message": "LinkedIn setup completed successfully"}


@router.get("/status")
async def get_linkedin_status(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    return await service.get_linkedin_status(db, _owner_ctx(current_user))


@router.get("/connect")
async def connect_linkedin(response: Response, lead_sync: bool = False, current_user: User = Depends(require_permission("org:inbox:manage"))):
    if not settings.linkedin_oauth_enabled:
        raise HTTPException(503, "LinkedIn OAuth is not configured.")
    scopes = service.requested_scopes(lead_sync)
    state, binding, verifier = await oauth.create_request(current_user.org_id, current_user.id, scopes)
    response.set_cookie(oauth.cookie_name(state), binding, max_age=oauth.STATE_TTL,
                        httponly=True, secure=settings.api_base_url.startswith("https://"),
                        samesite="lax", path="/v1/internal/integrations/linkedin/callback")
    response.headers["Cache-Control"] = "no-store"
    parts = urlsplit(settings.external_api_base_url)
    return {"authorization_url": service.get_authorization_url(state, verifier, scopes), "state": state,
            "callback_origin": parts.scheme + "://" + parts.netloc}


def callback_response(success: bool, state: str, message: str = "") -> Response:
    parts = urlsplit(settings.frontend_base_url)
    origin = parts.scheme + "://" + parts.netloc
    payload = json.dumps({"type": "linkedin_oauth_complete" if success else "linkedin_error", "error": message}).replace("<", "\\u003c")
    target = json.dumps(origin)
    redirect = json.dumps(origin + "/settings/integrations?linkedin=" + ("setup_required" if success else "error"))
    response = Response(content=f"""<!doctype html><html><head><title>LinkedIn connection</title></head>
    <body><p>Returning to integration settings...</p><script>
    if (window.opener) {{ window.opener.postMessage({payload}, {target}); window.close(); }}
    else {{ window.location.replace({redirect}); }}
    </script></body></html>""", media_type="text/html", headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
    response.delete_cookie(oauth.cookie_name(state), path="/v1/internal/integrations/linkedin/callback")
    return response


@router.get("/callback")
async def linkedin_callback(request: Request, code: str | None = Query(None), state: str | None = Query(None), error: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await oauth.consume_request(state, request.cookies.get(oauth.cookie_name(state or "")))
    if error or not code:
        return callback_response(False, state, "LinkedIn did not authorize the requested permissions. Check app product approval or connect without Lead Sync.")
    membership = (await db.execute(select(OrgMembership).where(
        OrgMembership.org_id == data["org_id"], OrgMembership.user_id == data["user_id"],
        OrgMembership.status == "active", OrgMembership.role.in_(["owner", "admin"])
    ))).scalar_one_or_none()
    if not membership:
        raise HTTPException(403, "Organization administrator access is required.")
    try:
        token_data = await service.exchange_code_for_token(code, data["verifier"])
        token = token_data.get("access_token")
        if not token:
            raise HTTPException(400, "LinkedIn returned no access token.")
        profile = await service.get_user_profile(token)
        granted = token_data.get("scope")
        scopes = granted.replace(",", " ").split() if isinstance(granted, str) else data["scopes"]
        await service.save_linkedin_credential(db, IntegrationOwnerContext(org_id=data["org_id"], user_id=data["user_id"], role=membership.role),
                                              token, int(token_data.get("expires_in") or 0), profile, scopes)
    except HTTPException as exc:
        return callback_response(False, state, str(exc.detail))
    return callback_response(True, state)


@router.post("/disconnect")
async def disconnect_linkedin(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    cred = await service.get_linkedin_credential(db, current_user.org_id)
    if cred and (cred.config or {}).get("lead_subscription"):
        await leads.unsubscribe(db, cred)
    await service.disconnect_linkedin(db, _owner_ctx(current_user))
    return {"message": "LinkedIn disconnected"}


class LeadSubscriptionRequest(BaseModel):
    sponsored_account_id: str | None = Field(default=None, pattern=r"^\d{1,30}$")


@router.post("/lead-subscription")
async def subscribe_leads(body: LeadSubscriptionRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    return await leads.subscribe(db, current_user.org_id, body.sponsored_account_id)


@router.delete("/lead-subscription")
async def unsubscribe_leads(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("org:inbox:manage"))):
    cred = await service.get_linkedin_credential(db, current_user.org_id)
    if not cred:
        raise HTTPException(404, "LinkedIn not connected")
    await leads.unsubscribe(db, cred)
    return {"message": "Lead Sync disconnected"}


@router.get("/webhook")
async def validate_webhook(challengeCode: str = Query(min_length=1, max_length=256)):
    if not settings.feature_linkedin_applicant_ingestion or not settings.linkedin_client_secret:
        raise HTTPException(404, "LinkedIn Lead Sync is unavailable")
    return {"challengeCode": challengeCode, "challengeResponse": hmac.new(settings.linkedin_client_secret.encode(), challengeCode.encode(), hashlib.sha256).hexdigest()}


@router.post("/webhook", status_code=202)
async def linkedin_applicant_webhook(request: Request, connection: UUID = Query(...), x_li_signature: str | None = Header(default=None, alias="X-LI-Signature")):
    if not settings.feature_linkedin_applicant_ingestion:
        raise HTTPException(404, "LinkedIn Lead Sync is disabled")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 65536:
            raise HTTPException(413, "Notification too large")
    if not service.verify_linkedin_webhook_signature(bytes(raw), x_li_signature):
        raise HTTPException(401, "Invalid LinkedIn webhook signature")
    try:
        event = json.loads(raw)
    except ValueError as exc:
        raise HTTPException(400, "Invalid JSON notification") from exc
    if not isinstance(event, dict) or event.get("type") != "LEAD_ACTION" or event.get("leadAction") not in ("CREATED", "DELETED") or not isinstance(event.get("leadGenFormResponse"), str) or not event["leadGenFormResponse"].startswith("urn:li:leadGenFormResponse:") or not isinstance(event.get("occurredAt"), int):
        raise HTTPException(400, "Invalid LinkedIn lead notification")
    digest = hashlib.sha256(f"{connection}:{event['leadGenFormResponse']}:{event['occurredAt']}".encode()).hexdigest()
    try:
        client = await asyncio.wait_for(get_temporal_client(), timeout=5)
        await asyncio.wait_for(client.start_workflow(LinkedInLeadWorkflow.run, args=[str(connection), event],
                    id="linkedin-lead-" + digest, task_queue="linkedin-leads", id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE), timeout=5)
    except WorkflowAlreadyStartedError:
        return {"status": "already_received"}
    except TimeoutError as exc:
        raise HTTPException(503, "Lead processing is temporarily unavailable; retry notification.") from exc
    return {"status": "queued"}
