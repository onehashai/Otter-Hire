"""
Integration tests for complete automation flow using real database.

Tests end-to-end automation execution with existing data.
"""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import Automation, AutomationExecution
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.template import Template
from app.models.user import User
from app.services.automation import execute_automations_for_trigger
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


@pytest.fixture
async def test_automation(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_template: Template,
) -> Automation:
    """Create test automation."""
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Application Confirmation",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={"label": "Candidate applied"},
        actions=[
            {
                "type": "send_email",
                "config": {"template": str(test_template.id)},
            }
        ],
        execution_count=0,
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return automation


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_complete_automation_flow(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_automation: Automation,
):
    """Test complete automation flow from trigger to execution."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    # Create test candidate
    test_candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        
        job_id=test_job.id,
        name="Test Automation Candidate",
        email="test@example.com",
        status="active",
    )
    db.add(test_candidate)
    await db.commit()
    await db.refresh(test_candidate)

    # Trigger automation
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        
        candidate_id=test_candidate.id,
        job_id=test_job.id,
        metadata={"source": "test"},
    )

    # Verify execution was logged
    exec_result = await db.execute(
        select(AutomationExecution)
        .where(
            AutomationExecution.automation_id == test_automation.id,
            AutomationExecution.candidate_id == test_candidate.id,
        )
        .order_by(AutomationExecution.created_at.desc())
        .limit(1)
    )
    execution = exec_result.scalar_one_or_none()

    assert execution is not None
    assert execution.status == "success"
    assert execution.trigger_event == "candidate_applied"
    assert execution.candidate_id == test_candidate.id

    # Verify automation stats updated
    await db.refresh(test_automation)
    assert test_automation.execution_count == 1
    assert test_automation.last_run_at is not None

    # Verify email was sent
    mock_enqueue_email.assert_called_once()


@pytest.mark.asyncio
@patch("app.temporal.email.queue.enqueue_outbound_email")
async def test_automation_with_multiple_candidates(
    mock_enqueue_email: AsyncMock,
    db: AsyncSession,
    test_org: Organization,
    test_job: Job,
    test_automation: Automation,
):
    """Test automation triggers for multiple candidates."""
    mock_enqueue_email.return_value = {"workflow_id": "test-wf", "started": True}

    # Create multiple candidates
    candidates = []
    for i in range(3):
        candidate = Candidate(
            id=uuid7(),
            org_id=test_org.id,
            
            job_id=test_job.id,
            name=f"Candidate {i+1}",
            email=f"candidate{i+1}@example.com",
            status="active",
        )
        db.add(candidate)
        candidates.append(candidate)

    await db.commit()

    # Trigger automation for each candidate
    for candidate in candidates:
        await execute_automations_for_trigger(
            db=db,
            trigger_key="candidate_applied",
            org_id=test_org.id,
            
            candidate_id=candidate.id,
            job_id=test_job.id,
            metadata={"source": "test"},
        )

    # Verify all executions logged
    exec_result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == test_automation.id)
    )
    executions = exec_result.scalars().all()

    assert len(executions) == 3
    assert all(e.status == "success" for e in executions)

    # Verify automation stats
    await db.refresh(test_automation)
    assert test_automation.execution_count == 3

    # Verify emails sent
    assert mock_enqueue_email.call_count == 3


@pytest.mark.asyncio
async def test_automation_with_missing_template(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
):
    """Test automation fails gracefully with missing template."""
    fake_template_id = uuid7()

    # Create automation with non-existent template
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Broken Automation",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[
            {
                "type": "send_email",
                "config": {"template": str(fake_template_id)},
            }
        ],
        execution_count=0,
    )
    db.add(automation)
    await db.commit()

    # Create candidate
    candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        
        job_id=test_job.id,
        name="Test Candidate",
        email="test@example.com",
        status="active",
    )
    db.add(candidate)
    await db.commit()

    # Trigger automation
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        
        candidate_id=candidate.id,
        job_id=test_job.id,
        metadata={},
    )

    # Verify execution logged as failed
    exec_result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    execution = exec_result.scalar_one_or_none()

    assert execution is not None
    assert execution.status == "failed"
    assert "not found" in execution.message.lower()
