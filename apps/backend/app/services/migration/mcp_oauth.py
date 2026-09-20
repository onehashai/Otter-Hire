from __future__ import annotations

import base64
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from mcp.client.auth.oauth2 import PKCEParameters
from mcp.client.auth.utils import (
    build_oauth_authorization_server_metadata_discovery_urls,
    build_protected_resource_metadata_discovery_urls,
    extract_resource_metadata_from_www_auth,
    extract_scope_from_www_auth,
    get_client_metadata_scopes,
    validate_metadata_issuer,
)
from mcp.shared.auth import (
    OAuthClientInformationFull,
    OAuthClientMetadata,
    OAuthMetadata,
    OAuthToken,
    ProtectedResourceMetadata,
)
from pydantic import ValidationError


class McpOAuthError(ValueError):
    pass


WORKABLE_MIGRATION_SCOPES = ("r_account", "r_jobs", "r_candidates")


@dataclass(frozen=True)
class OAuthStart:
    authorization_url: str
    state: str
    code_verifier: str
    metadata: dict[str, Any]
    client: dict[str, Any]


def validate_mcp_endpoint(endpoint_url: str) -> str:
    value = endpoint_url.strip().rstrip("/")
    try:
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
    except ValueError as exc:
        raise McpOAuthError("The MCP endpoint URL is invalid") from exc
    if parsed.scheme != "https" or not host:
        raise McpOAuthError("The MCP endpoint must use HTTPS")
    if parsed.username or parsed.password or parsed.port or parsed.fragment:
        raise McpOAuthError("The MCP endpoint contains unsupported URL components")
    if host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".localhost"):
        raise McpOAuthError("The MCP endpoint must be publicly reachable")
    return value


def _migration_scope(endpoint_url: str, discovered_scope: str | None) -> str | None:
    host = (urlparse(endpoint_url).hostname or "").lower()
    if host == "mcp.workable.com":
        available = set((discovered_scope or "").split())
        required = set(WORKABLE_MIGRATION_SCOPES)
        if not required.issubset(available):
            missing = ", ".join(sorted(required - available))
            raise McpOAuthError(
                f"The Workable MCP server does not advertise required scopes: {missing}"
            )
        return " ".join(WORKABLE_MIGRATION_SCOPES)
    return discovered_scope


def _initialize_payload() -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "SmartATS", "version": "1.0"},
        },
    }


async def _discover_oauth(
    endpoint_url: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> tuple[ProtectedResourceMetadata, OAuthMetadata, str | None]:
    endpoint_url = validate_mcp_endpoint(endpoint_url)
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
    }
    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=False,
            transport=transport,
        ) as client:
            challenge = await client.post(endpoint_url, headers=headers, json=_initialize_payload())
            if challenge.status_code != 401:
                raise McpOAuthError(
                    f"The MCP server did not advertise OAuth (HTTP {challenge.status_code})"
                )

            protected: ProtectedResourceMetadata | None = None
            advertised_url = extract_resource_metadata_from_www_auth(challenge)
            for url in build_protected_resource_metadata_discovery_urls(
                advertised_url, endpoint_url
            ):
                response = await client.get(url, headers={"Accept": "application/json"})
                if response.status_code != 200:
                    continue
                try:
                    protected = ProtectedResourceMetadata.model_validate(response.json())
                    break
                except (ValueError, ValidationError):
                    continue
            if protected is None:
                raise McpOAuthError("The MCP server has no valid protected-resource metadata")

            auth_server = str(protected.authorization_servers[0]).rstrip("/")
            oauth_metadata: OAuthMetadata | None = None
            for url in build_oauth_authorization_server_metadata_discovery_urls(
                auth_server, endpoint_url
            ):
                response = await client.get(url, headers={"Accept": "application/json"})
                if response.status_code != 200:
                    continue
                try:
                    candidate = OAuthMetadata.model_validate(response.json())
                    validate_metadata_issuer(candidate, auth_server)
                    oauth_metadata = candidate
                    break
                except (ValueError, ValidationError):
                    continue
            if oauth_metadata is None:
                raise McpOAuthError("The MCP authorization server metadata is unavailable")
    except httpx.RequestError as exc:
        raise McpOAuthError("The MCP OAuth server could not be reached") from exc

    scope = get_client_metadata_scopes(
        extract_scope_from_www_auth(challenge), protected, oauth_metadata
    )
    return protected, oauth_metadata, scope


async def _register_client(
    metadata: OAuthMetadata,
    callback_url: str,
    scope: str | None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> OAuthClientInformationFull:
    if metadata.registration_endpoint is None:
        raise McpOAuthError("The MCP authorization server does not support client registration")
    requested = OAuthClientMetadata(
        redirect_uris=[callback_url],
        token_endpoint_auth_method="none",
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        client_name="SmartATS",
        scope=scope,
    )
    try:
        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=False,
            transport=transport,
        ) as client:
            response = await client.post(
                str(metadata.registration_endpoint),
                headers={"Accept": "application/json"},
                json=requested.model_dump(mode="json", exclude_none=True),
            )
    except httpx.RequestError as exc:
        raise McpOAuthError("The MCP client registration endpoint could not be reached") from exc
    if response.status_code not in {200, 201}:
        raise McpOAuthError(
            f"The MCP server rejected client registration (HTTP {response.status_code})"
        )
    try:
        registered = OAuthClientInformationFull.model_validate(response.json())
    except (ValueError, ValidationError) as exc:
        raise McpOAuthError("The MCP server returned invalid client registration data") from exc
    if not registered.client_id:
        raise McpOAuthError("The MCP server did not return a client ID")
    return registered


async def begin_oauth(
    endpoint_url: str,
    callback_url: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> OAuthStart:
    protected, metadata, scope = await _discover_oauth(endpoint_url, transport=transport)
    scope = _migration_scope(endpoint_url, scope)
    if metadata.code_challenge_methods_supported is not None and (
        "S256" not in metadata.code_challenge_methods_supported
    ):
        raise McpOAuthError("The MCP authorization server does not support PKCE S256")
    registered = await _register_client(
        metadata, callback_url, scope, transport=transport
    )
    pkce = PKCEParameters.generate()
    state = secrets.token_urlsafe(32)
    params = {
        "response_type": "code",
        "client_id": str(registered.client_id),
        "redirect_uri": callback_url,
        "state": state,
        "code_challenge": pkce.code_challenge,
        "code_challenge_method": "S256",
        "resource": str(protected.resource),
    }
    if scope:
        params["scope"] = scope
    authorization_url = f"{metadata.authorization_endpoint}?{urlencode(params)}"
    client_data = registered.model_dump(mode="json", exclude_none=True)
    return OAuthStart(
        authorization_url=authorization_url,
        state=state,
        code_verifier=pkce.code_verifier,
        metadata={
            "authorization_endpoint": str(metadata.authorization_endpoint),
            "token_endpoint": str(metadata.token_endpoint),
            "registration_endpoint": str(metadata.registration_endpoint)
            if metadata.registration_endpoint
            else None,
            "resource": str(protected.resource),
            "scope": scope,
        },
        client=client_data,
    )


def _token_request_auth(
    client: dict[str, Any], data: dict[str, str]
) -> tuple[dict[str, str], dict[str, str]]:
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    method = client.get("token_endpoint_auth_method") or "none"
    secret = client.get("client_secret")
    if method == "client_secret_basic" and secret:
        encoded = base64.b64encode(
            f"{client['client_id']}:{secret}".encode()
        ).decode()
        headers["Authorization"] = f"Basic {encoded}"
    elif method == "client_secret_post" and secret:
        data["client_secret"] = str(secret)
    elif method not in {"none", "client_secret_basic", "client_secret_post"}:
        raise McpOAuthError(f"Unsupported MCP token authentication method: {method}")
    return data, headers


async def exchange_code(
    *,
    code: str,
    code_verifier: str,
    callback_url: str,
    metadata: dict[str, Any],
    client_info: dict[str, Any],
    transport: httpx.AsyncBaseTransport | None = None,
) -> OAuthToken:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": callback_url,
        "client_id": str(client_info["client_id"]),
        "code_verifier": code_verifier,
    }
    if metadata.get("resource"):
        data["resource"] = str(metadata["resource"])
    data, headers = _token_request_auth(client_info, data)
    try:
        async with httpx.AsyncClient(timeout=20, transport=transport) as client:
            response = await client.post(
                str(metadata["token_endpoint"]), data=data, headers=headers
            )
    except httpx.RequestError as exc:
        raise McpOAuthError("The MCP token endpoint could not be reached") from exc
    if response.status_code != 200:
        raise McpOAuthError(f"MCP token exchange failed (HTTP {response.status_code})")
    try:
        return OAuthToken.model_validate(response.json())
    except (ValueError, ValidationError) as exc:
        raise McpOAuthError("The MCP server returned an invalid token response") from exc


async def refresh_access_token(
    *,
    refresh_token: str,
    metadata: dict[str, Any],
    client_info: dict[str, Any],
    transport: httpx.AsyncBaseTransport | None = None,
) -> OAuthToken:
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": str(client_info["client_id"]),
    }
    if metadata.get("resource"):
        data["resource"] = str(metadata["resource"])
    data, headers = _token_request_auth(client_info, data)
    try:
        async with httpx.AsyncClient(timeout=20, transport=transport) as client:
            response = await client.post(
                str(metadata["token_endpoint"]), data=data, headers=headers
            )
    except httpx.RequestError as exc:
        raise McpOAuthError("The MCP token endpoint could not be reached") from exc
    if response.status_code != 200:
        raise McpOAuthError(f"MCP token refresh failed (HTTP {response.status_code})")
    try:
        return OAuthToken.model_validate(response.json())
    except (ValueError, ValidationError) as exc:
        raise McpOAuthError("The MCP server returned an invalid refresh response") from exc


def token_expiry(expires_in: int | None) -> str | None:
    if expires_in is None:
        return None
    return (datetime.now(UTC) + timedelta(seconds=max(expires_in - 60, 0))).isoformat()
