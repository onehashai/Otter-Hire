from datetime import datetime, timedelta, timezone
from hashlib import sha256

import pytest
from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.api.v1.internal.endpoints.auth import accept_invite, get_invite_details, signup
from app.models.org_membership import OrgMembership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import AcceptInviteRequest, SignupRequest
from app.utils.uuid import uuid7


def _request() -> Request:
    return Request({"type": "http", "headers": []})


@pytest.fixture
async def invite_seed(db: AsyncSession) -> tuple[str, User, OrgMembership, Organization]:
    raw_token = "test-invite-token"
    token_hash = sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)

    org = Organization(id=uuid7(), name="Invited Org")
    db.add(org)
    await db.flush()

    user = User(
        id=uuid7(),
        org_id=org.id,
        email="invitee@example.com",
        name="Invited User",
        hashed_password="",
        status="pending",
        role="user",
        is_verified=False,
        is_onboarded=False,
    )
    db.add(user)
    await db.flush()

    membership = OrgMembership(
        user_id=user.id,
        org_id=org.id,
        role="recruiter",
        status="pending",
        invite_token_hash=token_hash,
        invite_token_expires_at=expires_at,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(membership)
    await db.refresh(org)
    return raw_token, user, membership, org


@pytest.mark.asyncio
async def test_get_invite_details_returns_pending_state(
    db: AsyncSession,
    invite_seed: tuple[str, User, OrgMembership, Organization],
):
    raw_token, _, membership, _ = invite_seed
    response = await get_invite_details(request=_request(), token=raw_token, db=db)
    assert response.email == "invitee@example.com"
    assert response.status == "pending"
    assert response.role == membership.role
    assert response.suggested_name == "Invited User"


@pytest.mark.asyncio
async def test_invite_signup_sets_password_without_activating_membership(
    db: AsyncSession,
    invite_seed: tuple[str, User, OrgMembership, Organization],
):
    raw_token, user, membership, _ = invite_seed
    payload = SignupRequest(
        email=user.email,
        password="Secret123!",
        invite_token=raw_token,
    )
    response = Response()
    result = await signup(request=_request(), payload=payload, response=response, db=db)

    await db.refresh(user)
    await db.refresh(membership)

    assert result.email == user.email
    assert membership.status == "pending"
    assert user.hashed_password
    assert user.is_verified is False
    assert "access_token=" in response.headers.get("set-cookie", "")


@pytest.mark.asyncio
async def test_accept_invite_activates_membership_and_user(
    db: AsyncSession,
    invite_seed: tuple[str, User, OrgMembership, Organization],
):
    raw_token, user, membership, _ = invite_seed
    user.hashed_password = "seeded"
    await db.commit()
    await db.refresh(user)

    payload = AcceptInviteRequest(token=raw_token, name="Accepted Name")
    response = Response()
    result = await accept_invite(request=_request(), payload=payload, response=response, db=db)

    await db.refresh(user)
    await db.refresh(membership)

    assert result.status == "active"
    assert user.status == "active"
    assert membership.status == "active"
    assert user.name == "Accepted Name"
    assert user.is_verified is True
    assert user.is_onboarded is True
    assert membership.invite_token_hash is None
    assert "access_token=" in response.headers.get("set-cookie", "")

    active_membership = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user.id,
            OrgMembership.org_id == membership.org_id,
            OrgMembership.status == "active",
        )
    )
    assert active_membership.scalar_one_or_none() is not None
