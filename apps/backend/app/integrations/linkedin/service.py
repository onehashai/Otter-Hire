"""LinkedIn OAuth integration and distribution service."""

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.models.job import Job
from app.models.stage import Stage
from app.schemas.integrations import IntegrationOwnerContext
from app.services.storage import storage_service

# LinkedIn OAuth endpoints
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_PROFILE_URL = "https://api.linkedin.com/v2/userinfo"

# OAuth scopes
LINKEDIN_SCOPES = [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "w_organization_social",
    "rw_organization_admin",
    "r_marketing_leadgen_automation",
]


def requested_scopes(lead_sync: bool = False) -> list[str]:
    scopes = ["openid", "profile", "email", "w_organization_social", "rw_organization_admin"]
    if lead_sync and settings.feature_linkedin_applicant_ingestion:
        scopes.append("r_marketing_leadgen_automation")
    return scopes


def api_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}",
            "LinkedIn-Version": settings.linkedin_api_version,
            "X-Restli-Protocol-Version": "2.0.0"}


def credential_token(cred: IntegrationCredential) -> str:
    if not settings.encryption_key or not cred.encrypted_credentials:
        raise HTTPException(409, "Reconnect LinkedIn to authorize this action.")
    if float((cred.config or {}).get("token_expires_at") or 0) <= datetime.now(timezone.utc).timestamp():
        raise HTTPException(409, "LinkedIn authorization expired. Reconnect LinkedIn.")
    return decrypt_value(cred.encrypted_credentials, settings.encryption_key)


async def get_linkedin_integration(db: AsyncSession) -> Integration | None:
    """Get LinkedIn integration from integrations table."""
    result = await db.execute(select(Integration).where(Integration.slug == "linkedin"))
    return result.scalar_one_or_none()


async def get_linkedin_credential(db: AsyncSession, org_id: str) -> IntegrationCredential | None:
    """Get LinkedIn credential for an organization."""
    linkedin_integration = await get_linkedin_integration(db)
    if not linkedin_integration:
        return None

    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.org_id == org_id,
            IntegrationCredential.integration_id == linkedin_integration.id,
        )
    )
    return result.scalar_one_or_none()


def generate_oauth_state() -> str:
    """Generate secure random state for OAuth flow."""
    return secrets.token_urlsafe(32)


def get_authorization_url(state: str, verifier: str, scopes: list[str]) -> str:
    """Generate LinkedIn OAuth authorization URL."""
    if not settings.linkedin_oauth_enabled:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth is not configured")

    redirect_uri = f"{settings.external_api_base_url}/v1/internal/integrations/linkedin/callback"

    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": " ".join(scopes),
        "code_challenge": base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode(),
        "code_challenge_method": "S256",
    }

    return f"{LINKEDIN_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str, verifier: str) -> dict[str, Any]:
    """Exchange authorization code for access token."""
    if not settings.linkedin_oauth_enabled:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth is not configured")

    redirect_uri = f"{settings.external_api_base_url}/v1/internal/integrations/linkedin/callback"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
                "redirect_uri": redirect_uri,
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="LinkedIn authorization failed. Reconnect and check the registered callback URL.",
            )

        return response.json()


async def get_user_profile(access_token: str) -> dict[str, Any]:
    """Get LinkedIn user profile using access token."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            LINKEDIN_PROFILE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="LinkedIn profile permission is missing or authorization has expired.",
            )

        return response.json()


async def save_linkedin_credential(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    access_token: str,
    expires_in: int,
    profile: dict[str, Any],
    scopes: list[str] | None = None,
) -> IntegrationCredential:
    """Save LinkedIn OAuth credentials to database (without organization selection)."""
    linkedin_integration = await get_linkedin_integration(db)
    if not linkedin_integration:
        raise HTTPException(status_code=404, detail="LinkedIn integration not found")

    existing_cred = await get_linkedin_credential(db, owner.org_id)

    expires_at = datetime.now(timezone.utc).timestamp() + expires_in

    config = {
        "profile": {
            "sub": profile.get("sub"),
            "name": profile.get("name"),
            "email": profile.get("email"),
            "picture": profile.get("picture"),
        },
        "token_expires_at": expires_at,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "setup_complete": False,
        "scopes": scopes or [],
    }

    if not settings.encryption_key:
        raise RuntimeError("ENCRYPTION_KEY is not configured. Cannot store LinkedIn credentials.")

    if existing_cred:
        previous = existing_cred.config or {}
        if (previous.get("profile") or {}).get("sub") == profile.get("sub"):
            config["organization"] = previous.get("organization")
            config["setup_complete"] = bool(previous.get("setup_complete"))
            config["lead_subscription"] = previous.get("lead_subscription")
        existing_cred.encrypted_credentials = encrypt_value(access_token, settings.encryption_key)
        existing_cred.config = config
        existing_cred.status = "active" if config["setup_complete"] else "pending"
        await db.commit()
        await db.refresh(existing_cred)
        return existing_cred
    else:
        new_cred = IntegrationCredential(
            org_id=owner.org_id,
            integration_id=linkedin_integration.id,
            encrypted_credentials=encrypt_value(access_token, settings.encryption_key),
            config=config,
            status="pending",
        )
        db.add(new_cred)
        await db.commit()
        await db.refresh(new_cred)
        return new_cred


async def disconnect_linkedin(db: AsyncSession, owner: IntegrationOwnerContext) -> None:
    """Disconnect LinkedIn integration for an organization."""
    cred = await get_linkedin_credential(db, owner.org_id)
    if not cred:
        raise HTTPException(status_code=404, detail="LinkedIn integration not connected")

    await db.delete(cred)
    await db.commit()


async def get_linkedin_status(db: AsyncSession, owner: IntegrationOwnerContext) -> dict[str, Any]:
    """Get LinkedIn integration status for an organization."""
    cred = await get_linkedin_credential(db, owner.org_id)

    if not cred:
        return {
            "connected": False,
            "status": "not_connected",
            "oauth_configured": settings.linkedin_oauth_enabled,
            "distribution_enabled": settings.feature_linkedin_distribution,
            "lead_sync_enabled": settings.feature_linkedin_applicant_ingestion,
        }

    config = cred.config or {}
    profile = config.get("profile", {})
    organization = config.get("organization", {})

    # Derive setup state from persisted config first so legacy/drifted status
    # values do not force the UI into an incorrect "Connect" state.
    has_org_selection = bool(organization and organization.get("id"))
    setup_complete = bool(config.get("setup_complete")) and has_org_selection
    setup_incomplete = not setup_complete

    expired = float(config.get("token_expires_at") or 0) <= datetime.now(timezone.utc).timestamp()
    scopes = set(config.get("scopes") or [])
    return {
        "connected": not expired,
        "status": "expired" if expired else cred.status,
        "oauth_configured": settings.linkedin_oauth_enabled,
        "distribution_enabled": settings.feature_linkedin_distribution,
        "lead_sync_enabled": settings.feature_linkedin_applicant_ingestion,
        "can_post": not expired and setup_complete and settings.feature_linkedin_distribution and "w_organization_social" in scopes,
        "can_sync_leads": not expired and settings.feature_linkedin_applicant_ingestion and "r_marketing_leadgen_automation" in scopes,
        "lead_subscription": config.get("lead_subscription"),
        "lead_sync_last_error": config.get("lead_sync_last_error"),
        "setup_complete": setup_complete,
        "setup_incomplete": setup_incomplete,
        "profile": {
            "name": profile.get("name"),
            "email": profile.get("email"),
            "picture": profile.get("picture"),
        },
        "organization": {
            "id": organization.get("id"),
            "name": organization.get("name"),
            "vanity_name": organization.get("vanity_name"),
            "logo_url": organization.get("logo_url"),
        }
        if organization
        else None,
        "connected_at": config.get("connected_at"),
    }


async def get_linkedin_organizations(access_token: str) -> list[dict[str, Any]]:
    """Fetch LinkedIn organizations where user is admin."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.linkedin.com/rest/organizationAcls",
            params={"q": "roleAssignee", "role": "ADMINISTRATOR", "state": "APPROVED", "count": 100},
            headers=api_headers(access_token),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="LinkedIn denied Company Page access. Check app approval and Page admin permissions.",
            )

        data = response.json()
        elements = data.get("elements", [])

        # Filter for admin roles
        admin_orgs = []
        for element in elements:
            role = element.get("role")
            if role == "ADMINISTRATOR":
                org_urn = element.get("organization")
                if org_urn:
                    # Extract organization ID from URN (urn:li:organization:123456)
                    org_id = org_urn.split(":")[-1]
                    admin_orgs.append({"id": org_id, "urn": org_urn})

        # Fetch organization details for each admin org
        organizations = []
        for org in admin_orgs:
            try:
                org_details = await get_organization_details(access_token, org["id"])
                organizations.append(org_details)
            except Exception:
                # Skip organizations that fail to fetch
                continue

        return organizations


async def get_organization_details(access_token: str, org_id: str) -> dict[str, Any]:
    """Fetch LinkedIn organization details."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.linkedin.com/rest/organizations/{org_id}",
            headers=api_headers(access_token),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="LinkedIn Company Page details are not accessible.",
            )

        data = response.json()

        # Extract logo URL if available
        logo_url = None
        logo_v2 = data.get("logoV2", {})
        if logo_v2:
            original = logo_v2.get("original")
            if original:
                logo_url = original

        return {
            "id": org_id,
            "name": data.get("localizedName", ""),
            "vanity_name": data.get("vanityName", ""),
            "logo_url": logo_url,
        }


async def complete_linkedin_setup(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    organization_id: str,
    organization_name: str,
    organization_vanity_name: str,
    organization_logo_url: str | None,
) -> IntegrationCredential:
    """Complete LinkedIn setup by saving selected organization."""
    cred = await get_linkedin_credential(db, owner.org_id)
    if not cred:
        raise HTTPException(status_code=404, detail="LinkedIn integration not connected")

    organizations = await get_linkedin_organizations(credential_token(cred))
    organization = next((org for org in organizations if org["id"] == organization_id), None)
    if not organization:
        raise HTTPException(403, "You do not administer this LinkedIn Company Page.")

    existing_config = cred.config or {}
    if not isinstance(existing_config, dict):
        existing_config = {}

    # Reassign a new config object and mark modified so JSONB updates are
    # persisted reliably across all SQLAlchemy tracking modes.
    next_config = {
        **existing_config,
        "organization": {
            "id": organization_id,
            "name": organization["name"],
            "vanity_name": organization["vanity_name"],
            "logo_url": organization.get("logo_url"),
        },
        "setup_complete": True,
        "setup_completed_at": datetime.now(timezone.utc).isoformat(),
    }

    cred.config = next_config
    flag_modified(cred, "config")
    cred.status = "active"
    await db.commit()
    await db.refresh(cred)

    return cred


async def sync_job_distribution_to_linkedin(db: AsyncSession, job: Job) -> None:
    """Share a public job on the selected Company Page, never fabricate a post ID."""
    if not settings.feature_linkedin_distribution:
        job.linkedin_sync_status = "failed"
        job.linkedin_last_error = "LinkedIn distribution is disabled."
        return
    if job.status != "open" or job.visibility != "public":
        return
    persisted_status, persisted_id = (await db.execute(
        select(Job.linkedin_sync_status, Job.linkedin_external_job_id)
        .where(Job.id == job.id, Job.org_id == job.org_id).with_for_update()
    )).one()
    job.linkedin_sync_status = persisted_status
    job.linkedin_external_job_id = persisted_id
    if job.linkedin_external_job_id and job.linkedin_external_job_id.startswith("urn:li:"):
        return
    if job.linkedin_sync_status == "posting":
        job.linkedin_last_error = "Posting outcome is not yet confirmed. Check the Company Page before retrying."
        return

    cred = await get_linkedin_credential(db, str(job.org_id))
    if not cred:
        job.linkedin_sync_status = "failed"
        job.linkedin_last_error = "LinkedIn integration is not connected."
        return

    status = await get_linkedin_status(
        db,
        IntegrationOwnerContext(org_id=str(job.org_id), user_id=None, role="owner"),
    )
    if not status.get("can_post"):
        job.linkedin_sync_status = "failed"
        job.linkedin_last_error = "LinkedIn setup or posting permission is missing. Reconnect and select a Company Page."
        return

    try:
        token = credential_token(cred)
    except HTTPException as exc:
        job.linkedin_sync_status = "failed"
        job.linkedin_last_error = str(exc.detail)
        return
    company_id = (cred.config or {})["organization"]["id"]
    job_url = f"https://{settings.jobs_subdomain}.{settings.app_domain}/{job.org_id}/{job.id}"
    # Commit intent before the external side effect. An ambiguous timeout must not
    # trigger an automatic second public post on a subsequent publish request.
    job.linkedin_sync_status = "posting"
    job.linkedin_last_error = None
    await db.commit()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.linkedin.com/rest/posts", headers=api_headers(token),
                json={
                    "author": f"urn:li:organization:{company_id}",
                    "commentary": f"We're hiring: {job.title}\nApply: {job_url}",
                    "visibility": "PUBLIC", "lifecycleState": "PUBLISHED",
                    "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
                    "isReshareDisabledByAuthor": False,
                },
            )
    except httpx.HTTPError:
        job.linkedin_last_error = "LinkedIn response was interrupted. Check the Company Page before retrying."
        return
    post_id = response.headers.get("x-restli-id", "")
    if response.status_code == 201 and post_id.startswith("urn:li:"):
        job.linkedin_external_job_id = post_id
        job.linkedin_sync_status = "posted"
        job.linkedin_last_synced_at = datetime.now(timezone.utc)
    elif 400 <= response.status_code < 500:
        job.linkedin_sync_status = "failed"
        job.linkedin_last_error = f"LinkedIn rejected the post (HTTP {response.status_code}). Check Page permissions and app approval."
    else:
        job.linkedin_last_error = "LinkedIn did not confirm a post ID. Check the Company Page before retrying."


def verify_linkedin_webhook_signature(payload: bytes, signature: str | None) -> bool:
    secret = (settings.linkedin_client_secret or "").strip()
    if not secret:
        return False
    if not signature or len(signature) != 64 or not signature.isascii():
        return False
    digest = hmac.new(secret.encode(), b"hmacsha256=" + payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def ingest_linkedin_applicant_event(db: AsyncSession, event: dict[str, Any]) -> Candidate:
    """Ingest LinkedIn applicant payload and attach to job Applied stage.

    Expected payload (flexible):
      {
        "external_job_id": "linkedin-<job-id>" | "...",
        "applicant": {
          "name": "...",
          "email": "...",
          "resume_base64": "...",          # optional
          "resume_filename": "resume.pdf", # optional
          "resume_mime_type": "application/pdf" # optional
        }
      }
    """
    external_job_id = str(event.get("external_job_id") or "").strip()
    applicant = event.get("applicant") or {}
    name = str(applicant.get("name") or "").strip()
    email = str(applicant.get("email") or "").strip().lower()
    resume_base64 = applicant.get("resume_base64")
    resume_filename = str(applicant.get("resume_filename") or "linkedin_resume.pdf")
    resume_mime_type = str(applicant.get("resume_mime_type") or "application/pdf")

    if not external_job_id:
        raise HTTPException(status_code=400, detail="external_job_id is required")
    if not email:
        raise HTTPException(status_code=400, detail="applicant email is required")
    if not name:
        name = email.split("@")[0]

    job_result = await db.execute(
        select(Job).where(Job.linkedin_external_job_id == external_job_id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="No ATS job mapped for external_job_id")

    stage_result = await db.execute(
        select(Stage).where(Stage.job_id == job.id).order_by(Stage.position.asc())
    )
    first_stage = stage_result.scalars().first()

    candidate_result = await db.execute(
        select(Candidate).where(
            Candidate.org_id == job.org_id,
            Candidate.job_id == job.id,
            Candidate.email == email,
        )
    )
    candidate = candidate_result.scalar_one_or_none()

    if candidate is None:
        candidate = Candidate(
            org_id=job.org_id,
            job_id=job.id,
            stage_id=first_stage.id if first_stage else None,
            status="active",
            name=name,
            email=email,
            source="linkedin_apply",
            tags=[],
        )
        db.add(candidate)
        await db.flush()
    else:
        candidate.name = name or candidate.name
        if not candidate.stage_id and first_stage:
            candidate.stage_id = first_stage.id

    if isinstance(resume_base64, str) and resume_base64.strip():
        content = base64.b64decode(resume_base64)
        object_key = (
            f"orgs/{job.org_id}/jobs/{job.id}/candidates/{candidate.id}/linkedin/{uuid4().hex}"
            f"-{resume_filename}"
        )
        await storage_service.write_bytes(object_key, content, resume_mime_type)
        resume_url = await storage_service.resolve_url(object_key)

        db.add(
            CandidateDocument(
                org_id=job.org_id,
                candidate_id=candidate.id,
                job_id=job.id,
                field_key="resume",
                field_label_snapshot="Resume",
                doc_type="resume",
                name=resume_filename,
                url=resume_url,
                object_key=object_key,
                mime_type=resume_mime_type,
                size_bytes=len(content),
                version=1,
            )
        )

    await db.commit()
    await db.refresh(candidate)
    return candidate
