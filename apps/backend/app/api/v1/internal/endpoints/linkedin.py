"""LinkedIn integration API endpoints."""

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.config import settings
from app.db.session import get_db
from app.integrations.linkedin import service as linkedin_service
from app.models.user import User
from app.schemas.integrations import IntegrationOwnerContext
from app.schemas.linkedin import CompleteLinkedInSetupRequest

router = APIRouter(prefix="/integrations/linkedin", tags=["integrations"])


def _owner_ctx(current_user: User) -> IntegrationOwnerContext:
    return IntegrationOwnerContext(
        org_id=current_user.org_id,
        user_id=current_user.id,
        role=current_user.membership_role,
    )


@router.get("/organizations")
async def get_linkedin_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("org:inbox:manage")),
):
    """Get list of LinkedIn organizations where user is admin."""
    cred = await linkedin_service.get_linkedin_credential(db, current_user.org_id)
    if not cred:
        raise HTTPException(status_code=404, detail="LinkedIn not connected")

    access_token = cred.encrypted_credentials
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token found")

    organizations = await linkedin_service.get_linkedin_organizations(access_token)

    return {"organizations": organizations}


@router.post("/complete-setup")
async def complete_linkedin_setup(
    request: CompleteLinkedInSetupRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("org:inbox:manage")),
):
    """Complete LinkedIn setup by selecting organization."""
    await linkedin_service.complete_linkedin_setup(
        db,
        _owner_ctx(current_user),
        request.organization_id,
        request.organization_name,
        request.organization_vanity_name,
        request.organization_logo_url,
    )

    return {"message": "LinkedIn setup completed successfully"}


@router.get("/status")
async def get_linkedin_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("org:inbox:manage")),
):
    """Get LinkedIn integration status for current organization."""
    return await linkedin_service.get_linkedin_status(db, _owner_ctx(current_user))


@router.get("/connect")
async def connect_linkedin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("org:inbox:manage")),
):
    """Initiate LinkedIn OAuth flow."""
    # Generate state and store it (in production, store in Redis/session)
    state = linkedin_service.generate_oauth_state()

    # TODO: Store state in session/Redis for validation in callback
    # For now, we'll pass org_id in state (not secure for production)
    state_with_org = f"{state}:{current_user.org_id}"

    authorization_url = linkedin_service.get_authorization_url(state_with_org)

    return {
        "authorization_url": authorization_url,
        "state": state_with_org,
    }


@router.get("/callback")
async def linkedin_callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Handle LinkedIn OAuth callback."""
    if error:
        from app.core.config import settings

        frontend_url = settings.effective_frontend_base_url
        return Response(
            content=f"""
            <html>
                <head><title>LinkedIn Error</title></head>
                <body>
                    <h2>LinkedIn Authorization Failed</h2>
                    <p>{error}: {error_description or 'Unknown error'}</p>
                    <script>
                        window.opener?.postMessage({{ type: 'linkedin_error', error: '{error}' }}, '*');
                        setTimeout(() => window.close(), 3000);
                    </script>
                </body>
            </html>
            """,
            media_type="text/html",
        )

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    try:
        _, org_id = state.rsplit(":", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    token_data = await linkedin_service.exchange_code_for_token(code)
    access_token = token_data.get("access_token")
    expires_in = token_data.get("expires_in", 5184000)

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received")

    profile = await linkedin_service.get_user_profile(access_token)

    owner = IntegrationOwnerContext(
        org_id=org_id,
        user_id=None,
        role="owner",
    )

    await linkedin_service.save_linkedin_credential(db, owner, access_token, expires_in, profile)

    from app.core.config import settings

    frontend_url = settings.effective_frontend_base_url
    redirect_url = f"{frontend_url}/settings/integrations?linkedin=setup_required"

    return Response(
        content=f"""
        <html>
            <head>
                <title>LinkedIn Connected</title>
                <script>
                    window.opener?.postMessage({{ type: 'linkedin_oauth_complete' }}, '*');
                    setTimeout(() => window.close(), 1000);
                </script>
            </head>
            <body>
                <h2>LinkedIn OAuth Complete!</h2>
                <p>Completing setup...</p>
                <script>
                    setTimeout(() => {{
                        window.location.href = '{redirect_url}';
                    }}, 2000);
                </script>
            </body>
        </html>
        """,
        media_type="text/html",
    )


@router.post("/disconnect")
async def disconnect_linkedin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("org:inbox:manage")),
):
    """Disconnect LinkedIn integration."""
    await linkedin_service.disconnect_linkedin(db, _owner_ctx(current_user))

    return {"message": "LinkedIn integration disconnected successfully"}


@router.post("/webhook")
async def linkedin_applicant_webhook(
    request: Request,
    x_linkedin_signature: str | None = Header(default=None, alias="X-LinkedIn-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """Ingest LinkedIn applicant payload to ATS candidates pipeline."""
    if not settings.feature_linkedin_applicant_ingestion:
        raise HTTPException(status_code=404, detail="LinkedIn applicant ingestion feature is disabled")

    raw_body = await request.body()
    if not linkedin_service.verify_linkedin_webhook_signature(raw_body, x_linkedin_signature):
        raise HTTPException(status_code=401, detail="Invalid LinkedIn webhook signature")

    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid LinkedIn webhook payload")

    candidate = await linkedin_service.ingest_linkedin_applicant_event(db, payload)
    return {"message": "Applicant ingested", "candidate_id": str(candidate.id)}
