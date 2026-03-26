"""
Execution logging for automation runs.

Tracks all automation executions for audit and debugging.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.automation import Automation, AutomationExecution
from app.utils.uuid import uuid7


async def log_execution(
    db: AsyncSession,
    automation_id: UUID,
    org_id: UUID,
    trigger_event: str,
    candidate_id: UUID,
    job_id: UUID | None,
    success: bool,
    message: str | None = None,
) -> None:
    """
    Log an automation execution to the database.

    Args:
        db: Database session
        automation_id: Automation UUID
        org_id: Organization UUID
        trigger_event: Trigger key that fired
        candidate_id: Candidate UUID
        job_id: Optional job UUID
        success: Whether execution succeeded
        message: Optional message (error details if failed)
    """
    try:
        execution = AutomationExecution(
            id=uuid7(),
            org_id=org_id,
            automation_id=automation_id,
            trigger_event=trigger_event,
            candidate_id=candidate_id,
            job_id=job_id,
            status="success" if success else "failed",
            message=message,
        )
        db.add(execution)
        await db.flush()

        logger.info(
            f"Logged automation execution: automation={automation_id}, "
            f"trigger={trigger_event}, status={'success' if success else 'failed'}"
        )
    except Exception as e:
        logger.error(f"Failed to log automation execution: {e}", exc_info=True)
        # Don't raise - logging failure shouldn't break automation


async def update_automation_stats(
    db: AsyncSession,
    automation_id: UUID,
) -> None:
    """
    Update automation statistics after execution.

    Increments execution_count and updates last_run_at.

    Args:
        db: Database session
        automation_id: Automation UUID
    """
    try:
        # Fetch automation
        automation = await db.get(Automation, automation_id)
        if automation:
            automation.execution_count = (automation.execution_count or 0) + 1
            automation.last_run_at = datetime.utcnow()
            await db.flush()

            logger.debug(f"Updated stats for automation {automation_id}")
    except Exception as e:
        logger.error(f"Failed to update automation stats: {e}", exc_info=True)
        # Don't raise - stats update failure shouldn't break automation
