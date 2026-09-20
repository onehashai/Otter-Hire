"""LinkedIn Lead Sync subscriptions and tenant-bound lead ingestion."""

import re
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select

from app.core.config import settings
from app.integrations.linkedin.service import api_headers, credential_token, get_linkedin_credential
from app.models.candidate import Candidate
from app.models.integration_credential import IntegrationCredential

LEAD_SCOPE = "r_marketing_leadgen_automation"


def check_response(response: httpx.Response) -> None:
    if response.status_code in (401, 403):
        raise HTTPException(403, "LinkedIn Lead Sync access is missing. Check app approval, token permissions and account role.")
    if response.is_error:
        raise HTTPException(502, f"LinkedIn Lead Sync returned HTTP {response.status_code}. Try again later.")


async def subscribe(db, org_id: str, sponsored_account_id: str | None) -> dict:
    if not settings.feature_linkedin_applicant_ingestion:
        raise HTTPException(404, "LinkedIn Lead Sync is disabled.")
    cred = await get_linkedin_credential(db, org_id)
    if not cred or LEAD_SCOPE not in (cred.config or {}).get("scopes", []):
        raise HTTPException(403, "Reconnect LinkedIn with Lead Sync permission.")
    await db.refresh(cred, with_for_update=True)
    token = credential_token(cred)
    config = dict(cred.config or {})
    if sponsored_account_id:
        owner = {"sponsoredAccount": f"urn:li:sponsoredAccount:{sponsored_account_id}"}
        lead_type = "SPONSORED"
    else:
        company_id = (config.get("organization") or {}).get("id")
        if not company_id:
            raise HTTPException(409, "Select a Company Page first.")
        owner = {"organization": f"urn:li:organization:{company_id}"}
        lead_type = "COMPANY"
    existing = config.get("lead_subscription") or {}
    if existing.get("owner") == owner and existing.get("status") == "active":
        return existing
    if existing.get("status") == "active":
        raise HTTPException(409, "Disconnect the existing Lead Sync subscription before changing its account.")
    callback = f"{settings.api_base_url.rstrip('/')}/v1/internal/integrations/linkedin/webhook?connection={cred.id}"
    async with httpx.AsyncClient(timeout=20) as client:
        # A successful read proves the token can access this owner, not just a
        # user-supplied account ID. No ad management/write scope is necessary.
        key, urn = next(iter(owner.items()))
        response = await client.get("https://api.linkedin.com/rest/leadForms", headers=api_headers(token),
                                    params={"q": "owner", "owner": f"({key}:{urn})", "count": 1})
        check_response(response)
        response = await client.post("https://api.linkedin.com/rest/leadNotifications", headers=api_headers(token),
                                     json={"webhook": callback, "owner": owner, "leadType": lead_type})
        check_response(response)
        subscription_id = response.headers.get("x-restli-id")
        if response.status_code != 201 or not subscription_id:
            raise HTTPException(502, "LinkedIn did not confirm the subscription. Check Lead Sync setup before retrying.")
    subscription = {"id": subscription_id, "owner": owner, "lead_type": lead_type, "status": "active"}
    cred.config = {**config, "lead_subscription": subscription}
    await db.commit()
    return subscription


async def unsubscribe(db, cred: IntegrationCredential) -> None:
    config = dict(cred.config or {})
    subscription = config.get("lead_subscription") or {}
    if subscription.get("id"):
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.delete(
                "https://api.linkedin.com/rest/leadNotifications/" + quote(str(subscription["id"]), safe=""),
                headers=api_headers(credential_token(cred)),
            )
            if response.status_code != 404:
                check_response(response)
    cred.config = {**config, "lead_subscription": None}
    await db.commit()


def map_answers(lead: dict, form: dict) -> dict[str, str]:
    questions = {str(q["questionId"]): q for q in form.get("content", {}).get("questions", [])}
    fields = {}
    for answer in lead.get("formResponse", {}).get("answers", []):
        question = questions.get(str(answer.get("questionId")), {})
        name = question.get("predefinedField") or question.get("name")
        if not name:
            continue
        value = (answer.get("answerDetails") or {}).get("textQuestionAnswer", {}).get("answer")
        if isinstance(value, str):
            fields[re.sub(r"[^a-z0-9]", "", name.lower())] = value.strip()
    email = fields.get("email") or fields.get("emailaddress") or fields.get("workemail")
    try:
        email = str(TypeAdapter(EmailStr).validate_python(email)).lower()
    except ValidationError as exc:
        raise HTTPException(422, "LinkedIn lead has no valid email address; candidate was not created.") from exc
    name = fields.get("fullname") or " ".join(filter(None, [fields.get("firstname"), fields.get("lastname")]))
    return {"name": name or email.split("@")[0], "email": email,
            "phone": fields.get("phonenumber") or fields.get("phone") or fields.get("workphone") or "",
            "experience": fields.get("experience") or fields.get("yearsofexperience") or ""}


async def ingest_notification(db, connection: str, event: dict) -> str:
    # Serializing per connection prevents concurrent duplicate deliveries from
    # inserting duplicate candidates, including after Temporal retention expires.
    cred = (await db.execute(select(IntegrationCredential).where(
        IntegrationCredential.id == connection).with_for_update())).scalar_one_or_none()
    if not cred:
        return "disconnected"
    subscription = (cred.config or {}).get("lead_subscription") or {}
    if subscription.get("status") != "active" or subscription.get("owner") != event.get("owner") or subscription.get("lead_type") != event.get("leadType"):
        raise HTTPException(403, "Lead notification does not match this connection.")
    if event.get("leadAction") == "DELETED":
        return "withdrawn_notification_ignored"
    token = credential_token(cred)
    lead_id = event["leadGenFormResponse"].removeprefix("urn:li:leadGenFormResponse:")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.linkedin.com/rest/leadFormResponses/" + quote(lead_id, safe=""), headers=api_headers(token))
        check_response(response)
        lead = response.json()
        if lead.get("owner") != subscription["owner"] or lead.get("leadType") != subscription["lead_type"]:
            raise HTTPException(403, "LinkedIn lead owner does not match the subscription.")
        match = re.fullmatch(r"urn:li:versionedLeadGenForm:\(urn:li:leadGenForm:(\d+),\s*(\d+)\)", lead.get("versionedLeadGenFormUrn", ""))
        if not match:
            raise HTTPException(422, "LinkedIn returned an unsupported form identifier.")
        response = await client.get("https://api.linkedin.com/rest/leadForms/" + match[1], headers=api_headers(token))
        check_response(response)
        form = response.json()
        if form.get("owner") != subscription["owner"] or str(form.get("versionId")) != match[2]:
            raise HTTPException(422, "LinkedIn form changed. Review field mapping before importing this lead.")
    fields = map_answers(lead, form)
    existing = (await db.execute(select(Candidate).where(
        Candidate.org_id == cred.org_id, Candidate.email == fields["email"]
    ).order_by(Candidate.created_at).limit(1))).scalar_one_or_none()
    if existing:
        cred.config = {**cred.config, "lead_sync_last_error": None}
        await db.commit()
        return str(existing.id)
    candidate = Candidate(org_id=cred.org_id, name=fields["name"], email=fields["email"],
                          phone=fields["phone"] or None, status="active", source="linkedin_apply", tags=[],
                          external_candidate_id="linkedin:" + lead_id,
                          parsed_resume={"linkedin_lead": {"experience": fields["experience"], "form_id": match[1]}})
    db.add(candidate)
    cred.config = {**cred.config, "lead_sync_last_error": None}
    await db.flush()
    candidate_id = str(candidate.id)
    await db.commit()
    return candidate_id
