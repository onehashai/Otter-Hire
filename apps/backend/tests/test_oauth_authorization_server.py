import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.testclient import TestClient

from app.api.v1.oauth import (
    ApprovalRequest,
    _append_redirect_query,
    _hash,
    _redirect_matches,
    _valid_redirect_uri,
    _validate_authorization,
    token,
)
from app.mcp.server import create_mcp_server
from app.models.oauth import OAuthAuthorizationCode, OAuthClient, OAuthToken


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDb:
    def __init__(self, value):
        self.value = value

    async def execute(self, _statement):
        entity = _statement.column_descriptions[0]["entity"]
        value = self.value[entity] if isinstance(self.value, dict) else self.value
        return _Result(value)

    def add(self, value):
        self.added = getattr(self, "added", []) + [value]

    async def commit(self):
        pass


def test_redirect_validation_allows_loopback_ephemeral_port_and_registered_https():
    assert _valid_redirect_uri("http://localhost:49152/callback")
    assert _valid_redirect_uri("https://client.example/callback")
    assert _valid_redirect_uri("claude://oauth/callback")
    assert not _valid_redirect_uri("http://attacker.example/callback")
    assert not _valid_redirect_uri("https://user@client.example/callback")
    assert _redirect_matches("http://localhost:49152/callback", "http://localhost:43127/callback")
    assert not _redirect_matches("http://localhost:49152/callback", "http://localhost:43127/other")


def test_redirect_query_preserves_client_state_and_adds_code():
    result = _append_redirect_query(
        "https://client.example/cb?keep=1&state=old", {"code": "new", "state": "fresh"}
    )
    assert result == "https://client.example/cb?keep=1&state=fresh&code=new"


@pytest.mark.asyncio
async def test_authorize_rejects_scopes_not_registered_by_client():
    client = SimpleNamespace(
        client_id="client",
        grant_types=["authorization_code", "refresh_token"],
        redirect_uris=["http://localhost:43127/callback"],
        scope="mcp:read",
    )
    payload = ApprovalRequest(
        client_id="client",
        redirect_uri="http://localhost:49152/callback",
        scope="mcp:write",
        code_challenge="a" * 43,
    )
    with pytest.raises(HTTPException) as exc:
        await _validate_authorization(_FakeDb(client), payload)
    assert exc.value.detail["error"] == "invalid_scope"


@pytest.mark.asyncio
async def test_authorize_requires_s256_and_registered_redirect():
    client = SimpleNamespace(
        client_id="client",
        grant_types=["authorization_code"],
        redirect_uris=["https://client.example/callback"],
        scope="mcp:read",
    )
    bad_pkce = ApprovalRequest(
        client_id="client",
        redirect_uri="https://client.example/callback",
        code_challenge="a" * 43,
        code_challenge_method="plain",
    )
    with pytest.raises(HTTPException) as exc:
        await _validate_authorization(_FakeDb(client), bad_pkce)
    assert exc.value.detail["error"] == "invalid_request"
    bad_redirect = bad_pkce.model_copy(
        update={
            "redirect_uri": "https://attacker.example/callback",
            "code_challenge_method": "S256",
        }
    )
    with pytest.raises(HTTPException) as exc:
        await _validate_authorization(_FakeDb(client), bad_redirect)
    assert exc.value.detail["error"] == "invalid_request"


@pytest.mark.asyncio
async def test_token_exchange_checks_pkce_and_stores_only_token_hashes():
    verifier = "v" * 50
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    auth_code = SimpleNamespace(
        code_hash=_hash("one-time-code"),
        client_id="client",
        user_id="11111111-1111-4111-8111-111111111111",
        organization_id="22222222-2222-4222-8222-222222222222",
        redirect_uri="http://localhost:43127/callback",
        resource="http://localhost:8000/mcp",
        scope="mcp:read",
        code_challenge=challenge,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=2),
        is_used=False,
    )
    client = SimpleNamespace(
        client_id="client",
        client_secret_hash=None,
        token_endpoint_auth_method="none",
        grant_types=["authorization_code", "refresh_token"],
    )
    db = _FakeDb({OAuthClient: client, OAuthAuthorizationCode: auth_code})
    form = urlencode(
        {
            "grant_type": "authorization_code",
            "client_id": "client",
            "code": "one-time-code",
            "redirect_uri": auth_code.redirect_uri,
            "code_verifier": verifier,
        }
    ).encode()

    async def receive():
        return {"type": "http.request", "body": form, "more_body": False}

    request = Request(
        {"type": "http", "method": "POST", "path": "/v1/oauth/token", "headers": []},
        receive,
    )
    response = await token(request, db)
    body = json.loads(response.body)
    assert response.status_code == 200
    assert body["token_type"] == "Bearer"
    assert body["scope"] == "mcp:read"
    assert auth_code.is_used is True
    stored = next(value for value in db.added if isinstance(value, OAuthToken))
    assert stored.access_token_hash == _hash(body["access_token"])
    assert stored.refresh_token_hash == _hash(body["refresh_token"])
    assert stored.access_token_hash != body["access_token"]
    replay = await token(request, db)
    assert replay.status_code == 400
    assert json.loads(replay.body)["error"] == "invalid_grant"


def test_mcp_sse_bearer_validation_is_optional_for_legacy_api_key_tools():
    app = create_mcp_server().sse_app()
    paths = {getattr(route, "path", None) for route in app.routes}
    assert "/sse" in paths
    assert "/.well-known/oauth-protected-resource/mcp" in paths
    middleware = [item.cls.__name__ for item in app.user_middleware]
    assert middleware[:2] == ["AuthenticationMiddleware", "AuthContextMiddleware"]


def test_mcp_streamable_http_requires_oauth_and_keeps_legacy_sse_routes():
    server = create_mcp_server()
    app = server.streamable_http_app()
    routes = {getattr(route, "path", None): route for route in app.routes}

    assert "/mcp" in routes
    assert "/sse" in routes
    assert "/messages" in routes
    assert "/.well-known/oauth-protected-resource/mcp" in routes
    assert routes["/mcp"].app.__class__.__name__ == "RequireAuthMiddleware"
    middleware = [item.cls.__name__ for item in app.user_middleware]
    assert middleware[:2] == ["AuthenticationMiddleware", "AuthContextMiddleware"]

    client = TestClient(app)
    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    assert response.status_code == 401
    assert "resource_metadata=" in response.headers["www-authenticate"]

    metadata = client.get("/.well-known/oauth-protected-resource/mcp")
    assert metadata.status_code == 200
    body = metadata.json()
    assert body["resource"].endswith("/mcp")
    assert body["authorization_servers"] == [server.oauth_issuer_url]
