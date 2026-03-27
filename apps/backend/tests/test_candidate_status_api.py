"""
API endpoint tests for candidate status updates.

Tests idempotency, validation, and automation triggering.
"""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.user import User
from app.utils.uuid import uuid7


@pytest.fixture
async def test_org(db: AsyncSession) -> Organization:
    """Create test organization."""
    org = Organization(
        id=uuid7(),
        name="Test Org",
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def test_user(db: AsyncSession, test_org: Organization) -> User:
    """Create test user."""
    user = User(
        id=uuid7(),
        org_id=test_org.id,
        name="Test User",
        email="test@example.com",
        hashed_password="dummy",
        status="active",
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_job(db: AsyncSession, test_org: Organization, test_user: User) -> Job:
    """Create test job."""
    job = Job(
        id=uuid7(),
        org_id=test_org.id,
        title="Software Engineer",
        status="open",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@pytest.fixture
async def test_candidate(db: AsyncSession, test_org: Organization, test_job: Job) -> Candidate:
    """Create test candidate with active status."""
    candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        job_id=test_job.id,
        name="John Doe",
        email="john@example.com",
        status="active",
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_to_rejected(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test updating candidate status to rejected."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    # Mock current user
    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    # Create request
    request = CandidateStatusUpdateRequest(status="rejected")

    # Update status
    result = await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request,
        db=db,
        current_user=mock_user,
    )

    # Verify status changed
    assert result.status == "rejected"

    # Verify automation was triggered
    mock_execute_automations.assert_called_once()
    call_kwargs = mock_execute_automations.call_args.kwargs
    assert call_kwargs["trigger_key"] == "candidate_rejected"
    assert call_kwargs["candidate_id"] == test_candidate.id

    # Verify activity logged
    activity_result = await db.execute(
        select(Activity).where(
            Activity.candidate_id == test_candidate.id,
            Activity.type == "status_changed",
        )
    )
    activity = activity_result.scalar_one_or_none()
    assert activity is not None
    assert activity.metadata_["new_status"] == "rejected"


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_idempotency(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test idempotency - updating to same status should skip."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    # Set candidate to rejected
    test_candidate.status = "rejected"
    await db.commit()

    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    # Try to reject again
    request = CandidateStatusUpdateRequest(status="rejected")

    result = await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request,
        db=db,
        current_user=mock_user,
    )

    # Status should still be rejected
    assert result.status == "rejected"

    # Automation should NOT be triggered (idempotency)
    mock_execute_automations.assert_not_called()

    # No new activity should be logged
    activity_result = await db.execute(
        select(Activity).where(
            Activity.candidate_id == test_candidate.id,
            Activity.type == "status_changed",
        )
    )
    activities = activity_result.scalars().all()
    assert len(activities) == 0  # No new activity


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_to_hired(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test updating candidate status to hired."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    request = CandidateStatusUpdateRequest(status="hired")

    result = await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request,
        db=db,
        current_user=mock_user,
    )

    assert result.status == "hired"

    # Verify candidate_hired automation triggered
    mock_execute_automations.assert_called_once()
    call_kwargs = mock_execute_automations.call_args.kwargs
    assert call_kwargs["trigger_key"] == "candidate_hired"


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_to_active(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test updating candidate status to active (no automation)."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    # Set to rejected first
    test_candidate.status = "rejected"
    await db.commit()

    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    # Change back to active
    request = CandidateStatusUpdateRequest(status="active")

    result = await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request,
        db=db,
        current_user=mock_user,
    )

    assert result.status == "active"

    # No automation for active status
    mock_execute_automations.assert_not_called()


@pytest.mark.asyncio
async def test_update_candidate_status_not_found(db: AsyncSession):
    """Test updating non-existent candidate."""
    from fastapi import HTTPException

    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    fake_candidate_id = uuid7()
    mock_user = User(
        id=uuid7(),
        org_id=uuid7(),
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    request = CandidateStatusUpdateRequest(status="rejected")

    with pytest.raises(HTTPException) as exc_info:
        await update_candidate_status(
            candidate_id=fake_candidate_id,
            body=request,
            db=db,
            current_user=mock_user,
        )

    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_activity_metadata(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test activity log includes old and new status."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    # Initial status is "active"
    assert test_candidate.status == "active"

    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    request = CandidateStatusUpdateRequest(status="rejected")

    await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request,
        db=db,
        current_user=mock_user,
    )

    # Check activity metadata
    activity_result = await db.execute(
        select(Activity).where(
            Activity.candidate_id == test_candidate.id,
            Activity.type == "status_changed",
        )
    )
    activity = activity_result.scalar_one()

    assert activity.metadata_["old_status"] == "active"
    assert activity.metadata_["new_status"] == "rejected"


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.candidates.execute_automations_for_trigger")
async def test_update_candidate_status_multiple_times(
    mock_execute_automations: AsyncMock,
    db: AsyncSession,
    test_candidate: Candidate,
):
    """Test multiple status updates trigger automations correctly."""
    from app.api.v1.endpoints.candidates import update_candidate_status
    from app.models.user import User
    from app.schemas.candidates import CandidateStatusUpdateRequest

    mock_user = User(
        id=uuid7(),
        org_id=test_candidate.org_id,
        name="Admin",
        email="admin@example.com",
        status="active",
        role="user",
    )

    # First update: active -> rejected
    request1 = CandidateStatusUpdateRequest(status="rejected")
    await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request1,
        db=db,
        current_user=mock_user,
    )

    assert mock_execute_automations.call_count == 1

    # Second update: rejected -> active (should work, not idempotent)
    request2 = CandidateStatusUpdateRequest(status="active")
    await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request2,
        db=db,
        current_user=mock_user,
    )

    # Still 1 call (active doesn't trigger automation)
    assert mock_execute_automations.call_count == 1

    # Third update: active -> hired
    request3 = CandidateStatusUpdateRequest(status="hired")
    await update_candidate_status(
        candidate_id=test_candidate.id,
        body=request3,
        db=db,
        current_user=mock_user,
    )

    # Now 2 calls (hired triggers automation)
    assert mock_execute_automations.call_count == 2
