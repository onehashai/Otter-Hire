"""
Integration tests for automation execution system.

Tests the complete flow: trigger → query → execute → log
"""

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
        created_by_user_id=test_user.id,
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
        created_by_user_id=test_user.id,
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
        created_by_user_id=test_user.id,
        job_id=test_job.id,
        name="John Doe",
        email="john@example.com",
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
        created_by_user_id=test_user.id,
        name="Welcome Email",
        subject="Welcome {{candidate_name}}!",
        body="Hello {{candidate_name}}, welcome to {{company_name}}. Job: {{job_title}}",
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@pytest.mark.asyncio
async def test_automation_candidate_applied_trigger(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test automation fires on candidate_applied trigger."""
    # Create automation
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
    )
    db.add(automation)
    await db.commit()

    # Execute automation
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
        metadata={"source": "job_portal"},
    )

    # Verify execution was logged
    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    execution = result.scalar_one_or_none()

    assert execution is not None
    assert execution.trigger_event == "candidate_applied"
    assert execution.candidate_id == test_candidate.id
    assert execution.status == "success"

    # Verify automation stats updated
    await db.refresh(automation)
    assert automation.execution_count == 1
    assert automation.last_run_at is not None


@pytest.mark.asyncio
async def test_automation_scope_filtering_all_jobs(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test automation with scope='all' fires for any job."""
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="All Jobs Automation",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    db.add(automation)
    await db.commit()

    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
    )

    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    execution = result.scalar_one_or_none()
    assert execution is not None


@pytest.mark.asyncio
async def test_automation_scope_filtering_specific_job(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test automation with scope='specific_job' only fires for that job."""
    # Create another job
    other_job = Job(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        title="Other Job",
        status="open",
    )
    db.add(other_job)
    await db.commit()

    # Automation scoped to test_job
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Specific Job Automation",
        status="active",
        scope="specific_job",
        job_id=test_job.id,
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    db.add(automation)
    await db.commit()

    # Trigger for test_job - should fire
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
    )

    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    executions = result.scalars().all()
    assert len(executions) == 1

    # Trigger for other_job - should NOT fire
    other_candidate = Candidate(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        job_id=other_job.id,
        name="Jane Doe",
        email="jane@example.com",
        status="active",
    )
    db.add(other_candidate)
    await db.commit()

    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=other_candidate.id,
        job_id=other_job.id,
    )

    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    executions = result.scalars().all()
    # Still only 1 execution (from test_job)
    assert len(executions) == 1


@pytest.mark.asyncio
async def test_automation_candidate_moved_stage_filtering(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test candidate_moved trigger with stage filtering."""
    # Automation for moving to "Interview" stage
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Interview Stage Automation",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_moved",
        trigger_config={"stage": "Interview"},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    db.add(automation)
    await db.commit()

    # Move to Interview - should fire
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_moved",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
        metadata={"stage_name": "Interview"},
    )

    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    executions = result.scalars().all()
    assert len(executions) == 1

    # Move to Screening - should NOT fire
    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_moved",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
        metadata={"stage_name": "Screening"},
    )

    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    executions = result.scalars().all()
    # Still only 1 execution
    assert len(executions) == 1


@pytest.mark.asyncio
async def test_automation_draft_status_not_executed(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test draft automations are not executed."""
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Draft Automation",
        status="draft",  # Draft status
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    db.add(automation)
    await db.commit()

    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
    )

    # No execution should be logged
    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    execution = result.scalar_one_or_none()
    assert execution is None


@pytest.mark.asyncio
async def test_automation_multiple_automations_execute(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
    test_template: Template,
):
    """Test multiple automations with same trigger all execute."""
    automation1 = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Automation 1",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    automation2 = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Automation 2",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {"template": str(test_template.id)}}],
    )
    db.add_all([automation1, automation2])
    await db.commit()

    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
    )

    # Both should have executions
    result1 = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation1.id)
    )
    result2 = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation2.id)
    )

    assert result1.scalar_one_or_none() is not None
    assert result2.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_automation_missing_template_logs_failure(
    db: AsyncSession,
    test_org: Organization,
    test_user: User,
    test_job: Job,
    test_candidate: Candidate,
):
    """Test automation with missing template logs failure."""
    fake_template_id = uuid7()

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
        actions=[{"type": "send_email", "config": {"template": str(fake_template_id)}}],
    )
    db.add(automation)
    await db.commit()

    await execute_automations_for_trigger(
        db=db,
        trigger_key="candidate_applied",
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        candidate_id=test_candidate.id,
        job_id=test_job.id,
    )

    # Execution should be logged as failed
    result = await db.execute(
        select(AutomationExecution).where(AutomationExecution.automation_id == automation.id)
    )
    execution = result.scalar_one_or_none()

    assert execution is not None
    assert execution.status == "failed"
    assert "not found" in execution.message.lower()
