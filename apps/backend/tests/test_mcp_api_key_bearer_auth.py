import hashlib
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.mcp.server import DatabaseTokenVerifier


class _Result:
    def __init__(self, value=None):
        self.value = value

    def first(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value


class _Database:
    def __init__(self, api_key):
        self.api_key = api_key
        self.query_count = 0

    async def execute(self, _statement):
        self.query_count += 1
        if self.query_count == 1:
            return _Result()
        return _Result(self.api_key)


class _Session:
    def __init__(self, database):
        self.database = database

    async def __aenter__(self):
        return self.database

    async def __aexit__(self, *_args):
        return False


@pytest.mark.asyncio
async def test_api_key_is_accepted_as_bearer_token(monkeypatch):
    raw_key = "mcp_live_test-secret"
    organization_id = uuid4()
    key_id = uuid4()
    creator_id = uuid4()
    row = SimpleNamespace(
        id=key_id,
        org_id=organization_id,
        created_by=creator_id,
        key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
        scope="read_write",
    )
    db = _Database(row)
    monkeypatch.setattr("app.mcp.server.AsyncSessionLocal", lambda: _Session(db))

    token = await DatabaseTokenVerifier().verify_token(raw_key)

    assert token is not None
    assert token.client_id == "mcp-api-key"
    assert token.scopes == ["mcp:read", "mcp:write"]
    assert token.subject == str(creator_id)
    assert token.claims == {
        "org_id": str(organization_id),
        "token_id": str(key_id),
        "auth_type": "api_key",
    }


@pytest.mark.asyncio
async def test_unknown_bearer_token_is_rejected(monkeypatch):
    db = _Database(None)
    monkeypatch.setattr("app.mcp.server.AsyncSessionLocal", lambda: _Session(db))

    assert await DatabaseTokenVerifier().verify_token("mcp_live_unknown") is None
