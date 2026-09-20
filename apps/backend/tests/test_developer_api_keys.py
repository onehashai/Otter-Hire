from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.internal.endpoints.import_export import create_api_key, revoke_api_key
from app.core.config import settings
from app.models.api_key import ApiKey


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeSession:
    def __init__(self, result=None):
        self.added = None
        self.result = result
        self.commits = 0

    def add(self, value):
        self.added = value

    async def execute(self, _statement):
        return _ScalarResult(self.result)

    async def commit(self):
        self.commits += 1


@pytest.mark.anyio
async def test_create_api_key_returns_secret_once_and_stores_hash(monkeypatch):
    monkeypatch.setattr(settings, "ats_auto_import_enabled", True)
    org_id = uuid4()
    db = _FakeSession()

    response = await create_api_key(
        name="  Recruiting integration  ",
        db=db,
        user=SimpleNamespace(org_id=org_id),
    )

    assert response["key"].startswith("sk_live_")
    assert isinstance(db.added, ApiKey)
    assert db.added.org_id == org_id
    assert db.added.name == "Recruiting integration"
    assert db.added.key_prefix == response["key"][:16]
    assert db.added.key_hash != response["key"]
    assert db.commits == 1


@pytest.mark.anyio
async def test_revoke_api_key_disables_org_key(monkeypatch):
    monkeypatch.setattr(settings, "ats_auto_import_enabled", True)
    org_id = uuid4()
    api_key = ApiKey(
        id=uuid4(),
        org_id=org_id,
        name="Recruiting integration",
        key_prefix="sk_live_example",
        key_hash="a" * 64,
        is_active=True,
    )
    db = _FakeSession(result=api_key)

    response = await revoke_api_key(
        key_id=api_key.id,
        db=db,
        user=SimpleNamespace(org_id=org_id),
    )

    assert response.status_code == 204
    assert api_key.is_active is False
    assert db.commits == 1


@pytest.mark.anyio
async def test_revoke_api_key_rejects_unknown_key(monkeypatch):
    monkeypatch.setattr(settings, "ats_auto_import_enabled", True)
    db = _FakeSession(result=None)

    with pytest.raises(HTTPException) as exc_info:
        await revoke_api_key(
            key_id=uuid4(),
            db=db,
            user=SimpleNamespace(org_id=uuid4()),
        )

    assert exc_info.value.status_code == 404
    assert db.commits == 0
