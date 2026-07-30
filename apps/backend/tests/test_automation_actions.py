"""
Unit tests for automation action handlers.

Tests email sending and action execution logic.
"""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.template import Template
from app.models.user import User
from app.services.automation.actions import (
    execute_action,
    handle_send_email_action,
)
from app.utils.uuid import uuid7


@pytest.fixture
async def test_org(db: AsyncSession) -> Organization:
    """Create test organization."""
    org = Organization(
        id=uuid7(),
        name="Test Company",
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
    """Create test candidate."""
    candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        job_id=test_job.id,
        name="Jane Doe",
        email="jane.doe@example.com",
        status="active",
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@pytest.fixture
async def test_template(db: AsyncSession, test_org: Organization, test_user: User) -> Template:
    """Create test email template."""
    template = Template(
        id=uuid7(),
        org_id=test_org.id,
        name="Welcome Email",
        subject="Welcome {{candidate_name}}!",
        body="Hello {{candidate_name}}, welcome to {{company_name}}.",
        category="candidate",
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_handle_send_email_action_success(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
    test_job: Job,
    test_template: Template,
):
    """Test successful email sending action."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    action_config = {"template": str(test_template.id)}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=test_job.id,
        metadata=None,
    )

    assert success is True
    assert "jane.doe@example.com" in message
    mock_enqueue_email.assert_called_once()

    # Verify email content
    call_args = mock_enqueue_email.call_args
    input_obj = call_args.args[0]
    assert input_obj.to_email == "jane.doe@example.com"
    assert "Jane Doe" in input_obj.subject
    assert "Jane Doe" in input_obj.body


@pytest.mark.asyncio
async def test_handle_send_email_action_no_template_id(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test email action with missing template ID."""
    action_config = {}  # No template specified

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "No template specified" in message


@pytest.mark.asyncio
async def test_handle_send_email_action_invalid_template_id(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test email action with invalid template ID format."""
    action_config = {"template": "not-a-valid-uuid"}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "Invalid template ID" in message


@pytest.mark.asyncio
async def test_handle_send_email_action_template_not_found(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test email action with non-existent template."""
    fake_template_id = uuid7()
    action_config = {"template": str(fake_template_id)}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "not found" in message


@pytest.mark.asyncio
async def test_handle_send_email_action_no_candidate_email(
    db: AsyncSession,
    test_org: Organization,
    test_job: Job,
    test_template: Template,
):
    """Test email action when candidate has no email."""
    # Create candidate without email
    candidate_no_email = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        job_id=test_job.id,
        name="No Email User",
        email="",  # Empty email
        status="active",
    )
    db.add(candidate_no_email)
    await db.commit()

    action_config = {"template": str(test_template.id)}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=candidate_no_email.id,
        org_id=test_org.id,
        job_id=test_job.id,
        metadata=None,
    )

    assert success is False
    assert "no email address" in message.lower()


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_handle_send_email_action_send_fails(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test email action when send_email raises exception."""
    mock_enqueue_email.side_effect = Exception("SMTP connection failed")

    action_config = {"template": str(test_template.id)}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "Failed to enqueue email" in message


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_execute_action_send_email(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test execute_action routing to send_email handler."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    action = {
        "type": "send_email",
        "config": {"template": str(test_template.id)},
    }

    success, message = await execute_action(
        db=db,
        action=action,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is True
    mock_enqueue_email.assert_called_once()


@pytest.mark.asyncio
async def test_execute_action_unknown_type(
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test execute_action with unknown action type."""
    action = {
        "type": "unknown_action_type",
        "config": {},
    }

    success, message = await execute_action(
        db=db,
        action=action,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "Unknown action type" in message


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_execute_action_missing_config(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
):
    """Test execute_action with missing config."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    action = {
        "type": "send_email",
        # No config provided
    }

    success, message = await execute_action(
        db=db,
        action=action,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=None,
    )

    assert success is False
    assert "No template specified" in message


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_handle_send_email_with_metadata(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test email action with metadata for context."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    # Template with stage_name variable
    test_template.body = "You moved to {{stage_name}} stage."
    await db.commit()

    action_config = {"template": str(test_template.id)}
    metadata = {"stage_name": "Interview"}

    success, message = await handle_send_email_action(
        db=db,
        action_config=action_config,
        candidate_id=test_candidate.id,
        org_id=test_org.id,
        job_id=None,
        metadata=metadata,
    )

    assert success is True

    # Verify metadata was used in rendering
    call_args = mock_enqueue_email.call_args
    input_obj = call_args.args[0]
    assert "Interview stage" in input_obj.body
