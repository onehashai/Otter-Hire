"""LinkedIn OAuth integration service."""

import secrets
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.integration import Integration
from app.models.integration_credential import IntegrationCredential
from app.schemas.integrations import IntegrationOwnerContext

# LinkedIn OAuth endpoints
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_PROFILE_URL = "https://api.linkedin.com/v2/userinfo"

# OAuth scopes
LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"]


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


def get_authorization_url(state: str) -> str:
    """Generate LinkedIn OAuth authorization URL."""
    if not settings.linkedin_oauth_enabled:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth is not configured")

    redirect_uri = settings.effective_linkedin_redirect_uri
    if not redirect_uri:
        raise HTTPException(status_code=500, detail="LinkedIn redirect URI is not configured")

    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": " ".join(LINKEDIN_SCOPES),
    }

    query_string = "&".join(f"{k}={httpx.QueryParams({k: v})[k]}" for k, v in params.items())
    return f"{LINKEDIN_AUTH_URL}?{query_string}#force-login"


async def exchange_code_for_token(code: str) -> dict[str, Any]:
    """Exchange authorization code for access token."""
    if not settings.linkedin_oauth_enabled:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth is not configured")

    redirect_uri = settings.effective_linkedin_redirect_uri
    if not redirect_uri:
        raise HTTPException(status_code=500, detail="LinkedIn redirect URI is not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange code for token: {response.text}",
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
                detail=f"Failed to fetch user profile: {response.text}",
            )

        return response.json()


async def save_linkedin_credential(
    db: AsyncSession,
    owner: IntegrationOwnerContext,
    access_token: str,
    expires_in: int,
    profile: dict[str, Any],
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
    }

    if existing_cred:
        existing_cred.encrypted_credentials = access_token
        existing_cred.config = config
        existing_cred.status = "pending"
        await db.commit()
        await db.refresh(existing_cred)
        return existing_cred
    else:
        new_cred = IntegrationCredential(
            org_id=owner.org_id,
            integration_id=linkedin_integration.id,
            encrypted_credentials=access_token,
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
        }

    config = cred.config or {}
    profile = config.get("profile", {})
    organization = config.get("organization", {})
    setup_complete = config.get("setup_complete", False)

    return {
        "connected": True,
        "status": cred.status,
        "setup_complete": setup_complete,
        "setup_incomplete": cred.status == "pending" and not setup_complete,
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
            "https://api.linkedin.com/v2/organizationAcls",
            params={"q": "roleAssignee"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "LinkedIn-Version": "202405",
            },
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch organizations: {response.text}",
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
            f"https://api.linkedin.com/v2/organizations/{org_id}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "LinkedIn-Version": "202405",
            },
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch organization details: {response.text}",
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

    config = cred.config or {}
    config["organization"] = {
        "id": organization_id,
        "name": organization_name,
        "vanity_name": organization_vanity_name,
        "logo_url": organization_logo_url,
    }
    config["setup_complete"] = True
    config["setup_completed_at"] = datetime.now(timezone.utc).isoformat()

    cred.config = config
    cred.status = "active"
    await db.commit()
    await db.refresh(cred)

    return cred
