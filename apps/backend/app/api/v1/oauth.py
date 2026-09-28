from __future__ import annotations

import base64
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.deps.auth import require_active_user
from app.models.oauth import OAuthAuthorizationCode, OAuthClient, OAuthToken
from app.models.org_membership import OrgMembership
from app.models.user import User

router = APIRouter()
oauth_router = APIRouter(prefix="/oauth", tags=["oauth"])
SUPPORTED_SCOPES = {"mcp:read", "mcp:write", "ats:all"}
ACCESS_TOKEN_TTL = timedelta(hours=1)
REFRESH_TOKEN_TTL = timedelta(days=30)
AUTH_CODE_TTL = timedelta(minutes=5)


class ClientRegistration(BaseModel):
    client_name: str = Field(min_length=1, max_length=160)
    redirect_uris: list[str] = Field(min_length=1, max_length=20)
    grant_types: list[str] = Field(default_factory=lambda: ["authorization_code", "refresh_token"])
    response_types: list[str] = Field(default_factory=lambda: ["code"])
    scope: str = "mcp:read mcp:write"
    token_endpoint_auth_method: str = "none"


class ApprovalRequest(BaseModel):
    client_id: str
    redirect_uri: str
    response_type: str = "code"
    scope: str = "mcp:read"
    state: str | None = None
    code_challenge: str
    code_challenge_method: str = "S256"
    resource: str | None = None


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _issuer(request: Request) -> str:
    configured = settings.oauth_issuer_url or settings.external_api_base_url
    if configured:
        return configured.rstrip("/")
    if settings.is_production:
        raise HTTPException(503, detail="OAuth issuer URL is not configured")
    return str(request.base_url).rstrip("/")


def _web_base(request: Request) -> str:
    configured = (
        settings.oauth_web_base_url or settings.oauth_issuer_url or settings.external_api_base_url
    )
    if configured:
        return configured.rstrip("/")
    if settings.is_production:
        raise HTTPException(503, detail="OAuth web base URL is not configured")
    return str(request.base_url).rstrip("/")


def _mcp_resource_url() -> str:
    base = settings.oauth_issuer_url or settings.external_api_base_url
    if not base:
        if settings.is_production:
            raise RuntimeError("Set OAUTH_ISSUER_URL before enabling MCP OAuth in production")
        base = "http://localhost:8000"
    return f"{base.rstrip('/')}/mcp"


def _redirect_matches(requested: str, registered: str) -> bool:
    if requested == registered:
        return True
    req, reg = urlsplit(requested), urlsplit(registered)
    loopback = {"localhost", "127.0.0.1", "[::1]", "::1"}
    return bool(
        req.scheme == reg.scheme == "http"
        and req.hostname in loopback
        and reg.hostname in loopback
        and req.hostname == reg.hostname
        and req.path == reg.path
        and req.query == reg.query
        and req.fragment == reg.fragment
        and req.username is None
        and req.password is None
    )


def _valid_redirect_uri(uri: str) -> bool:
    try:
        parsed = urlsplit(uri)
    except ValueError:
        return False
    if parsed.username or parsed.password or parsed.fragment or not parsed.scheme:
        return False
    if parsed.scheme == "https":
        return bool(parsed.hostname)
    if parsed.scheme == "http":
        return parsed.hostname in {"localhost", "127.0.0.1", "::1", "[::1]"}
    return parsed.scheme in {"claude", "vscode", "cursor"} and bool(parsed.netloc)


async def _get_client(db: AsyncSession, client_id: str) -> OAuthClient:
    client = (
        await db.execute(select(OAuthClient).where(OAuthClient.client_id == client_id))
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(400, detail={"error": "invalid_client"})
    return client


async def _validate_authorization(db: AsyncSession, params: ApprovalRequest) -> OAuthClient:
    client = await _get_client(db, params.client_id)
    if params.response_type != "code" or "authorization_code" not in (client.grant_types or []):
        raise HTTPException(400, detail={"error": "unsupported_response_type"})
    if not any(_redirect_matches(params.redirect_uri, uri) for uri in (client.redirect_uris or [])):
        raise HTTPException(
            400, detail={"error": "invalid_request", "error_description": "redirect_uri mismatch"}
        )
    if params.code_challenge_method != "S256" or not re.fullmatch(
        r"[A-Za-z0-9_-]{43,128}", params.code_challenge
    ):
        raise HTTPException(
            400, detail={"error": "invalid_request", "error_description": "S256 PKCE is required"}
        )
    scopes = set(params.scope.split())
    if not scopes or not scopes <= SUPPORTED_SCOPES or not scopes <= set(client.scope.split()):
        raise HTTPException(400, detail={"error": "invalid_scope"})
    expected_resource = _mcp_resource_url()
    if params.resource and params.resource.rstrip("/") != expected_resource.rstrip("/"):
        raise HTTPException(
            400, detail={"error": "invalid_target", "error_description": "Unsupported resource"}
        )
    return client


@router.get("/.well-known/oauth-authorization-server")
@router.get("/.well-known/openid-configuration")
async def oauth_discovery(request: Request) -> dict[str, Any]:
    issuer = _issuer(request)
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/api/v1/oauth/authorize",
        "token_endpoint": f"{issuer}/api/v1/oauth/token",
        "registration_endpoint": f"{issuer}/api/v1/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": sorted(SUPPORTED_SCOPES),
        "token_endpoint_auth_methods_supported": [
            "none",
            "client_secret_post",
            "client_secret_basic",
        ],
        "revocation_endpoint": f"{issuer}/api/v1/oauth/revoke",
        "code_response_types_supported": ["code"],
    }


@oauth_router.post("/register", status_code=201)
async def register_client(
    payload: ClientRegistration, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    if payload.response_types != ["code"]:
        raise HTTPException(
            400,
            detail={
                "error": "invalid_client_metadata",
                "error_description": "Only response_type=code is supported",
            },
        )
    if (
        not set(payload.grant_types) <= {"authorization_code", "refresh_token"}
        or "authorization_code" not in payload.grant_types
    ):
        raise HTTPException(
            400,
            detail={
                "error": "invalid_client_metadata",
                "error_description": "Unsupported grant_types",
            },
        )
    if payload.token_endpoint_auth_method not in {
        "none",
        "client_secret_post",
        "client_secret_basic",
    }:
        raise HTTPException(400, detail={"error": "invalid_client_metadata"})
    if not set(payload.scope.split()) <= SUPPORTED_SCOPES:
        raise HTTPException(
            400,
            detail={"error": "invalid_client_metadata", "error_description": "Unsupported scope"},
        )
    if any(not _valid_redirect_uri(uri) for uri in payload.redirect_uris):
        raise HTTPException(400, detail={"error": "invalid_redirect_uri"})
    if not payload.client_name.strip() or len(set(payload.redirect_uris)) != len(
        payload.redirect_uris
    ):
        raise HTTPException(400, detail={"error": "invalid_client_metadata"})

    client_id = f"ohc_{secrets.token_urlsafe(24)}"
    secret = secrets.token_urlsafe(40) if payload.token_endpoint_auth_method != "none" else None
    client = OAuthClient(
        client_id=client_id,
        client_secret_hash=_hash(secret) if secret else None,
        client_name=payload.client_name.strip(),
        redirect_uris=payload.redirect_uris,
        grant_types=payload.grant_types,
        response_types=payload.response_types,
        scope=payload.scope,
        token_endpoint_auth_method=payload.token_endpoint_auth_method,
    )
    db.add(client)
    await db.commit()
    result: dict[str, Any] = {
        "client_id": client_id,
        "client_id_issued_at": int(datetime.now(timezone.utc).timestamp()),
        "client_name": client.client_name,
        "redirect_uris": client.redirect_uris,
        "grant_types": client.grant_types,
        "response_types": client.response_types,
        "scope": client.scope,
        "token_endpoint_auth_method": client.token_endpoint_auth_method,
    }
    if secret:
        result["client_secret"] = secret
        result["client_secret_expires_at"] = 0
    return result


@oauth_router.get("/authorize")
async def authorize(request: Request, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    params = ApprovalRequest(**dict(request.query_params))
    await _validate_authorization(db, params)
    consent_url = f"{_web_base(request)}/oauth/authorize?{urlencode(dict(request.query_params))}"
    return RedirectResponse(consent_url, status_code=302)


@oauth_router.get("/authorize-params")
async def authorize_params(
    client_id: str,
    redirect_uri: str,
    response_type: str = "code",
    scope: str = "mcp:read",
    state: str | None = None,
    code_challenge: str = "",
    code_challenge_method: str = "S256",
    resource: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    params = ApprovalRequest(
        client_id=client_id,
        redirect_uri=redirect_uri,
        response_type=response_type,
        scope=scope,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        resource=resource,
    )
    client = await _validate_authorization(db, params)
    return {"client_name": client.client_name, "scope": scope.split(), "redirect_uri": redirect_uri}


def _append_redirect_query(uri: str, values: dict[str, str]) -> str:
    parsed = urlsplit(uri)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query.update({key: [value] for key, value in values.items()})
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query, doseq=True), parsed.fragment)
    )


@oauth_router.post("/approve")
async def approve(
    payload: ApprovalRequest,
    request: Request,
    user: User = Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    origin = request.headers.get("origin")
    allowed_origins = {value.rstrip("/") for value in settings.cors_origins}
    allowed_origins.add(_web_base(request).rstrip("/"))
    if origin and origin.rstrip("/") not in allowed_origins:
        raise HTTPException(403, detail="Authorization request origin is not allowed")
    client = await _validate_authorization(db, payload)
    membership = (
        await db.execute(
            select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.org_id == user.org_id,
                OrgMembership.status == "active",
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(403, detail="Active organization membership required")
    code = secrets.token_urlsafe(40)
    db.add(
        OAuthAuthorizationCode(
            code_hash=_hash(code),
            client_id=client.client_id,
            user_id=user.id,
            organization_id=user.org_id,
            redirect_uri=payload.redirect_uri,
            resource=payload.resource or _mcp_resource_url(),
            scope=payload.scope,
            code_challenge=payload.code_challenge,
            code_challenge_method="S256",
            expires_at=datetime.now(timezone.utc) + AUTH_CODE_TTL,
        )
    )
    await db.commit()
    values = {"code": code}
    if payload.state:
        values["state"] = payload.state
    return {"redirect_url": _append_redirect_query(payload.redirect_uri, values)}


@oauth_router.post("/deny")
async def deny(payload: ApprovalRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await _validate_authorization(db, payload)
    values = {"error": "access_denied", "error_description": "The user denied the request"}
    if payload.state:
        values["state"] = payload.state
    return {"redirect_url": _append_redirect_query(payload.redirect_uri, values)}


async def _authenticate_client(
    request: Request, data: dict[str, str], db: AsyncSession
) -> OAuthClient:
    client_id = data.get("client_id", "")
    secret = data.get("client_secret")
    auth = request.headers.get("authorization", "")
    if auth.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth[6:]).decode("utf-8")
            client_id, secret = decoded.split(":", 1)
        except Exception as exc:
            raise HTTPException(401, detail={"error": "invalid_client"}) from exc
    client = await _get_client(db, client_id)
    if client.token_endpoint_auth_method == "none":
        if secret:
            raise HTTPException(401, detail={"error": "invalid_client"})
    elif (
        not secret
        or not client.client_secret_hash
        or not secrets.compare_digest(_hash(secret), client.client_secret_hash)
    ):
        raise HTTPException(401, detail={"error": "invalid_client"})
    return client


@oauth_router.post("/token")
async def token(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    data = {key: values[-1] for key, values in parse_qs(raw_body, keep_blank_values=True).items()}
    try:
        client = await _authenticate_client(request, data, db)
        grant = data.get("grant_type")
        now = datetime.now(timezone.utc)
        if grant == "authorization_code":
            code = data.get("code", "")
            verifier = data.get("code_verifier", "")
            row = (
                await db.execute(
                    select(OAuthAuthorizationCode)
                    .join(User, User.id == OAuthAuthorizationCode.user_id)
                    .join(
                        OrgMembership,
                        (OrgMembership.user_id == OAuthAuthorizationCode.user_id)
                        & (OrgMembership.org_id == OAuthAuthorizationCode.organization_id),
                    )
                    .where(
                        OAuthAuthorizationCode.code_hash == _hash(code),
                        OAuthAuthorizationCode.client_id == client.client_id,
                        User.status == "active",
                        User.is_verified.is_(True),
                        User.is_onboarded.is_(True),
                        OrgMembership.status == "active",
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if not row or row.is_used or row.expires_at <= now:
                raise HTTPException(400, detail={"error": "invalid_grant"})
            if (
                data.get("redirect_uri") != row.redirect_uri
                or not 43 <= len(verifier) <= 128
                or not re.fullmatch(r"[A-Za-z0-9._~-]{43,128}", verifier)
            ):
                raise HTTPException(400, detail={"error": "invalid_grant"})
            expected = (
                base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
                .rstrip(b"=")
                .decode()
            )
            if not secrets.compare_digest(expected, row.code_challenge):
                raise HTTPException(400, detail={"error": "invalid_grant"})
            row.is_used = True
            scopes = set(row.scope.split())
            access = secrets.token_urlsafe(48)
            refresh = (
                secrets.token_urlsafe(48) if "refresh_token" in (client.grant_types or []) else None
            )
            db.add(
                OAuthToken(
                    access_token_hash=_hash(access),
                    refresh_token_hash=_hash(refresh) if refresh else None,
                    client_id=client.client_id,
                    user_id=row.user_id,
                    organization_id=row.organization_id,
                    resource=row.resource,
                    scope=" ".join(sorted(scopes)),
                    expires_at=now + ACCESS_TOKEN_TTL,
                    refresh_expires_at=now + REFRESH_TOKEN_TTL if refresh else None,
                )
            )
        elif grant == "refresh_token":
            refresh = data.get("refresh_token", "")
            if "refresh_token" not in (client.grant_types or []):
                raise HTTPException(400, detail={"error": "unauthorized_client"})
            row = (
                await db.execute(
                    select(OAuthToken)
                    .join(User, User.id == OAuthToken.user_id)
                    .join(
                        OrgMembership,
                        (OrgMembership.user_id == OAuthToken.user_id)
                        & (OrgMembership.org_id == OAuthToken.organization_id),
                    )
                    .where(
                        OAuthToken.refresh_token_hash == _hash(refresh),
                        OAuthToken.client_id == client.client_id,
                        OAuthToken.revoked.is_(False),
                        OAuthToken.refresh_expires_at > now,
                        User.status == "active",
                        User.is_verified.is_(True),
                        User.is_onboarded.is_(True),
                        OrgMembership.status == "active",
                    )
                    .with_for_update(of=OAuthToken)
                )
            ).scalar_one_or_none()
            if not row:
                raise HTTPException(400, detail={"error": "invalid_grant"})
            access = secrets.token_urlsafe(48)
            next_refresh = secrets.token_urlsafe(48)
            row.access_token_hash = _hash(access)
            row.refresh_token_hash = _hash(next_refresh)
            row.expires_at = now + ACCESS_TOKEN_TTL
            row.refresh_expires_at = now + REFRESH_TOKEN_TTL
            refresh = next_refresh
            scopes = set(row.scope.split())
        else:
            raise HTTPException(400, detail={"error": "unsupported_grant_type"})
        await db.commit()
        return JSONResponse(
            {
                "access_token": access,
                "token_type": "Bearer",
                "expires_in": int(ACCESS_TOKEN_TTL.total_seconds()),
                "refresh_token": refresh,
                "scope": " ".join(sorted(scopes)),
            },
            headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
        )
    except HTTPException as exc:
        detail = (
            exc.detail
            if isinstance(exc.detail, dict)
            else {"error": "invalid_request", "error_description": str(exc.detail)}
        )
        return JSONResponse(
            detail, status_code=exc.status_code, headers={"Cache-Control": "no-store"}
        )


@oauth_router.post("/revoke")
async def revoke(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    data = {key: values[-1] for key, values in parse_qs(raw_body, keep_blank_values=True).items()}
    try:
        client = await _authenticate_client(request, data, db)
    except HTTPException:
        return Response(status_code=200)
    token_value = data.get("token", "")
    row = (
        await db.execute(
            select(OAuthToken).where(
                OAuthToken.client_id == client.client_id,
                (OAuthToken.access_token_hash == _hash(token_value))
                | (OAuthToken.refresh_token_hash == _hash(token_value)),
            )
        )
    ).scalar_one_or_none()
    if row:
        row.revoked = True
        await db.commit()
    return Response(status_code=200)
