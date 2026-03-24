"""
Unit tests for automation execution logger.

Tests execution logging and statistics updates.
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import Automation, AutomationExecution
from app.models.organization import Organization
from app.models.user import User
from app.services.automation.logger import log_execution, update_automation_stats
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
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_automation(
    db: AsyncSession, test_org: Organization, test_user: User
) -> Automation:
    """Create test automation."""
    automation = Automation(
        id=uuid7(),
        org_id=test_org.id,
        created_by_user_id=test_user.id,
        name="Test Automation",
        status="active",
        scope="all",
        trigger_type="candidate",
        trigger_key="candidate_applied",
        trigger_config={},
        actions=[{"type": "send_email", "config": {}}],
        execution_count=0,
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return automation


@pytest.mark.asyncio
async def test_log_execution_success(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test logging successful execution."""
    candidate_id = uuid7()
    
    await log_execution(
        db=db,
        automation_id=test_automation.id,
        trigger_event="candidate_applied",
        candidate_id=candidate_id,
        job_id=None,
        status="success",
        message="Email sent successfully",
    )
    
    # Verify execution was logged
    result = await db.execute(
        select(AutomationExecution).where(
            AutomationExecution.automation_id == test_automation.id
        )
    )
    execution = result.scalar_one()
    
    assert execution.trigger_event == "candidate_applied"
    assert execution.candidate_id == candidate_id
    assert execution.status == "success"
    assert execution.message == "Email sent successfully"
    assert execution.created_at is not None


@pytest.mark.asyncio
async def test_log_execution_failure(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test logging failed execution."""
    candidate_id = uuid7()
    
    await log_execution(
        db=db,
        automation_id=test_automation.id,
        trigger_event="candidate_rejected",
        candidate_id=candidate_id,
        job_id=None,
        status="failed",
        message="Template not found",
    )
    
    result = await db.execute(
        select(AutomationExecution).where(
            AutomationExecution.automation_id == test_automation.id
        )
    )
    execution = result.scalar_one()
    
    assert execution.status == "failed"
    assert "Template not found" in execution.message


@pytest.mark.asyncio
async def test_log_execution_with_job_id(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test logging execution with job context."""
    candidate_id = uuid7()
    job_id = uuid7()
    
    await log_execution(
        db=db,
        automation_id=test_automation.id,
        trigger_event="candidate_moved",
        candidate_id=candidate_id,
        job_id=job_id,
        status="success",
        message="Stage changed",
    )
    
    result = await db.execute(
        select(AutomationExecution).where(
            AutomationExecution.automation_id == test_automation.id
        )
    )
    execution = result.scalar_one()
    
    assert execution.job_id == job_id


@pytest.mark.asyncio
async def test_update_automation_stats(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test updating automation statistics."""
    # Initial state
    assert test_automation.execution_count == 0
    assert test_automation.last_run_at is None
    
    # Update stats
    await update_automation_stats(
        db=db,
        automation_id=test_automation.id,
    )
    
    # Refresh from database
    await db.refresh(test_automation)
    
    # Verify stats updated
    assert test_automation.execution_count == 1
    assert test_automation.last_run_at is not None
    assert isinstance(test_automation.last_run_at, datetime)


@pytest.mark.asyncio
async def test_update_automation_stats_multiple_times(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test execution count increments correctly."""
    # Run 3 times
    for i in range(3):
        await update_automation_stats(
            db=db,
            automation_id=test_automation.id,
        )
        await db.refresh(test_automation)
        assert test_automation.execution_count == i + 1


@pytest.mark.asyncio
async def test_log_multiple_executions(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test logging multiple executions."""
    candidate_ids = [uuid7() for _ in range(3)]
    
    for candidate_id in candidate_ids:
        await log_execution(
            db=db,
            automation_id=test_automation.id,
            trigger_event="candidate_applied",
            candidate_id=candidate_id,
            job_id=None,
            status="success",
            message="Email sent",
        )
    
    # Verify all executions logged
    result = await db.execute(
        select(AutomationExecution).where(
            AutomationExecution.automation_id == test_automation.id
        )
    )
    executions = result.scalars().all()
    
    assert len(executions) == 3
    assert all(e.status == "success" for e in executions)


@pytest.mark.asyncio
async def test_log_execution_different_statuses(
    db: AsyncSession,
    test_automation: Automation,
):
    """Test logging executions with different statuses."""
    candidate_id = uuid7()
    
    # Log success
    await log_execution(
        db=db,
        automation_id=test_automation.id,
        trigger_event="candidate_applied",
        candidate_id=candidate_id,
        job_id=None,
        status="success",
        message="Success",
    )
    
    # Log failure
    await log_execution(
        db=db,
        automation_id=test_automation.id,
        trigger_event="candidate_applied",
        candidate_id=candidate_id,
        job_id=None,
        status="failed",
        message="Failed",
    )
    
    # Verify both logged
    result = await db.execute(
        select(AutomationExecution).where(
            AutomationExecution.automation_id == test_automation.id
        )
    )
    executions = result.scalars().all()
    
    assert len(executions) == 2
    statuses = {e.status for e in executions}
    assert statuses == {"success", "failed"}
