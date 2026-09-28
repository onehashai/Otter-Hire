from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request

from app.api.v1.internal.endpoints import organizations, public
from app.models.blocked_email_address import BlockedEmailAddress
from app.models.email import InboundEmail
from app.schemas.organization import CreateBlockedEmailAddressesRequest
from app.schemas.public_jobs import InboundEmailPayload
from app.services import blocked_domains
from app.temporal.inbound_email import activities
from app.temporal.inbound_email.types import InboundEmailParseInput

ORG_ID = UUID("00000000-0000-0000-0000-000000000001")


def test_email_block_normalization_preserves_exact_mailbox() -> None:
    assert (
        blocked_domains.normalize_blocked_email_address("  Spam.User+Tag@GMAIL.COM ")
        == "spam.user+tag@gmail.com"
    )
    request = CreateBlockedEmailAddressesRequest(emails=[" SPAM@gmail.com ", "spam@gmail.com"])
    assert request.emails == ["spam@gmail.com"]


@pytest.mark.parametrize(
    "email", ["gmail.com", "@gmail.com", "spam@", "a b@gmail.com", "", "https://gmail.com"]
)
def test_invalid_email_blocks_are_rejected(email) -> None:
    with pytest.raises(ValidationError):
        CreateBlockedEmailAddressesRequest(emails=[email])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "sender,blocked",
    [
        ("Spammer <SPAM@gmail.com>", True),
        ("other@gmail.com", False),
        ("spam+tag@gmail.com", False),
        ("spam@mail.gmail.com", False),
    ],
)
async def test_email_blocks_match_only_one_address_in_one_org(sender, blocked) -> None:
    queries = []

    async def execute(statement):
        queries.append(statement)
        result = Mock()
        if statement.column_descriptions[0]["entity"] is BlockedEmailAddress:
            params = statement.compile().params
            assert params["org_id_1"] == ORG_ID
            result.scalar_one_or_none.return_value = (
                uuid4() if params["email_1"] == "spam@gmail.com" else None
            )
        else:
            result.scalars.return_value.all.return_value = []
        return result

    db = AsyncMock()
    db.execute.side_effect = execute
    reason = await blocked_domains.get_blocked_sender_reason(db, org_id=ORG_ID, sender_email=sender)
    assert bool(reason) is blocked
    if blocked:
        assert reason == "Sender email spam@gmail.com is in organization blocked list"
    assert len(queries) == 2


@pytest.mark.asyncio
async def test_domain_blocks_remain_unchanged_and_short_circuit_email_lookup() -> None:
    db = AsyncMock()
    result = Mock()
    result.scalars.return_value.all.return_value = ["naukri.com"]
    db.execute.return_value = result
    assert (
        await blocked_domains.get_blocked_sender_reason(
            db, org_id=ORG_ID, sender_email="candidate@mail.naukri.com"
        )
        == "Sender domain mail.naukri.com is in organization blocked list"
    )
    db.execute.assert_awaited_once()


def user(role="owner"):
    return SimpleNamespace(id=uuid4(), org_id=ORG_ID, membership_role=role)


@pytest.mark.asyncio
async def test_list_and_create_email_blocks_are_scoped_and_duplicate_safe() -> None:
    db = AsyncMock()
    row = SimpleNamespace(
        id=uuid4(),
        email="spam@gmail.com",
        created_at=datetime.now(timezone.utc),
        created_by_user_id=None,
    )
    result = Mock()
    result.scalars.return_value.all.return_value = [row]
    db.execute.return_value = result
    listed = await organizations.list_blocked_email_addresses(current_user=user(), db=db)
    assert listed[0].email == row.email
    assert db.execute.call_args.args[0].compile().params["org_id_1"] == ORG_ID
    db.execute.reset_mock()
    created = await organizations.create_blocked_email_addresses(
        CreateBlockedEmailAddressesRequest(emails=["spam@gmail.com"]), current_user=user(), db=db
    )
    assert created[0].id == row.id
    statement = db.execute.call_args_list[0].args[0]
    assert "ON CONFLICT (org_id, email) DO NOTHING" in str(statement)
    assert statement.compile().params["org_id_m0"] == ORG_ID
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["list", "create", "delete"])
async def test_members_cannot_manage_email_blocks(operation) -> None:
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        if operation == "list":
            await organizations.list_blocked_email_addresses(current_user=user("member"), db=db)
        elif operation == "create":
            await organizations.create_blocked_email_addresses(
                CreateBlockedEmailAddressesRequest(emails=["spam@gmail.com"]),
                current_user=user("member"),
                db=db,
            )
        else:
            await organizations.delete_blocked_email_address(
                uuid4(), current_user=user("member"), db=db
            )
    assert exc.value.status_code == 403
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_unblock_cannot_remove_another_organizations_rule() -> None:
    db = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = None
    db.execute.return_value = result
    with pytest.raises(HTTPException) as exc:
        await organizations.delete_blocked_email_address(uuid4(), current_user=user(), db=db)
    assert exc.value.status_code == 404
    assert db.execute.call_args.args[0].compile().params["org_id_1"] == ORG_ID
    db.delete.assert_not_awaited()


@pytest.mark.asyncio
async def test_unblock_deletes_only_the_selected_block_rule() -> None:
    db = AsyncMock()
    row = BlockedEmailAddress(id=uuid4(), org_id=ORG_ID, email="spam@gmail.com")
    result = Mock()
    result.scalar_one_or_none.return_value = row
    db.execute.return_value = result
    await organizations.delete_blocked_email_address(row.id, current_user=user(), db=db)
    db.delete.assert_awaited_once_with(row)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_receiver_logs_blocked_email_without_uploading_or_parsing(monkeypatch) -> None:
    from app.temporal.inbound_email import queue as inbound_queue

    payload = InboundEmailPayload(
        inbox_address="careers@example.com", from_email="spam@gmail.com", subject="Application"
    )
    raw = payload.model_dump_json().encode()

    async def receive():
        return {"type": "http.request", "body": raw}

    request = Request({"type": "http", "headers": [], "method": "POST", "path": "/"}, receive)
    db = AsyncMock()
    added = []
    db.add = Mock(side_effect=added.append)
    monkeypatch.setattr(
        public.credential_store, "get_job_credential_by_address", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        public.credential_store,
        "get_org_credential_by_address",
        AsyncMock(return_value=SimpleNamespace(org_id=ORG_ID, config={})),
    )
    monkeypatch.setattr(public.settings, "inbound_webhook_secret", "test-secret")
    monkeypatch.setattr(public, "_verify_hmac_signature", lambda *args: True)
    reason = "Sender email spam@gmail.com is in organization blocked list"
    monkeypatch.setattr(public, "get_blocked_sender_reason", AsyncMock(return_value=reason))
    upload = AsyncMock()
    monkeypatch.setattr(public.storage_service, "write_bytes", upload)
    queue = AsyncMock()
    monkeypatch.setattr(inbound_queue, "enqueue_inbound_email_parse", queue)
    await public.ingest_inbound_email.__wrapped__(request, signature="test", db=db)
    assert len(added) == 1
    assert added[0].parse_status == "ignored"
    assert added[0].parse_error == reason
    upload.assert_not_awaited()
    queue.assert_not_awaited()


@pytest.mark.asyncio
async def test_worker_rechecks_email_block_before_reading_documents(monkeypatch) -> None:
    from app.services.storage import storage_service

    row = InboundEmail(
        id=uuid4(), org_id=ORG_ID, from_email="spam@gmail.com", parse_status="processing"
    )
    session = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = row
    session.execute.return_value = result
    session.__aenter__.return_value = session
    monkeypatch.setattr(activities, "AsyncSessionLocal", lambda: session)
    reason = "Sender email spam@gmail.com is in organization blocked list"
    monkeypatch.setattr(
        blocked_domains, "get_blocked_sender_reason", AsyncMock(return_value=reason)
    )
    read = AsyncMock()
    monkeypatch.setattr(storage_service, "read_bytes", read)
    response = await activities.parse_inbound_email_activity(
        InboundEmailParseInput(inbound_email_id=str(row.id), org_id=str(ORG_ID))
    )
    assert response["status"] == "ignored"
    assert row.parse_error == reason
    read.assert_not_awaited()
    session.add.assert_not_called()
