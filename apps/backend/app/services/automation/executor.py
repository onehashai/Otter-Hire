"""
Main automation execution engine.

Handles trigger events and executes matching automations.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.automation import Automation, AutomationExecution
from app.services.automation.actions import execute_action
from app.services.automation.logger import log_execution, update_automation_stats


async def execute_automations_for_trigger(
    db: AsyncSession,
    trigger_key: str,
    org_id: UUID,
    candidate_id: UUID,
    job_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    """
    Execute all automations matching the given trigger.

    This is the main entry point called when events occur.

    Args:
        db: Database session
        trigger_key: Trigger identifier (e.g., "candidate_applied")
        org_id: Organization UUID
        candidate_id: Candidate UUID
        job_id: Optional job UUID for scope filtering
        metadata: Optional metadata from trigger event
    """
    try:
        logger.info(
            f"Processing automations for trigger={trigger_key}, "
            f"org={org_id}, candidate={candidate_id}, job={job_id}"
        )

        # Query matching automations
        automations = await _query_matching_automations(
            db=db,
            trigger_key=trigger_key,
            org_id=org_id,
            job_id=job_id,
            metadata=metadata,
        )

        if not automations:
            logger.debug(f"No active automations found for trigger {trigger_key}")
            return

        logger.info(f"Found {len(automations)} matching automation(s)")

        # Execute each automation independently
        for automation in automations:
            await _execute_single_automation(
                db=db,
                automation=automation,
                trigger_key=trigger_key,
                candidate_id=candidate_id,
                job_id=job_id,
                metadata=metadata,
            )

        # Commit all execution logs
        await db.commit()

    except Exception as e:
        logger.error(f"Error processing automations for trigger {trigger_key}: {e}", exc_info=True)
        # Don't raise - automation failures shouldn't break the main flow


async def _query_matching_automations(
    db: AsyncSession,
    trigger_key: str,
    org_id: UUID,
    job_id: UUID | None,
    metadata: dict | None,
) -> list[Automation]:
    """
    Query automations that match the trigger and scope.

    Args:
        db: Database session
        trigger_key: Trigger identifier
        org_id: Organization UUID
        job_id: Optional job UUID
        metadata: Optional trigger metadata

    Returns:
        List of matching Automation objects
    """
    # Base query: active automations for this org and trigger
    query = select(Automation).where(
        Automation.org_id == org_id,
        Automation.status == "active",
        Automation.trigger_key == trigger_key,
    )

    # Apply scope filtering
    if job_id:
        # Match automations with scope="all" OR scope="specific_job" with matching job_id
        query = query.where(
            or_(
                Automation.scope == "all",
                and_(Automation.scope == "specific_job", Automation.job_id == job_id),
            )
        )
    else:
        # No job context, only match "all" scope
        query = query.where(Automation.scope == "all")

    result = await db.execute(query)
    automations = list(result.scalars().all())

    # Apply trigger config filtering (e.g., stage matching for candidate_moved)
    filtered_automations = []
    for automation in automations:
        if _matches_trigger_config(automation, trigger_key, metadata):
            filtered_automations.append(automation)

    return filtered_automations


def _matches_trigger_config(
    automation: Automation, trigger_key: str, metadata: dict | None
) -> bool:
    """
    Check if automation's trigger_config matches the event metadata.

    For example, candidate_moved trigger may specify a required stage.

    Args:
        automation: Automation object
        trigger_key: Trigger identifier
        metadata: Event metadata

    Returns:
        True if automation should fire, False otherwise
    """
    trigger_config = automation.trigger_config or {}

    # For candidate_moved, check if stage matches
    if trigger_key == "candidate_moved":
        required_stage = trigger_config.get("stage")
        if required_stage:
            actual_stage = (metadata or {}).get("stage_name")
            if required_stage != actual_stage:
                logger.debug(
                    f"Automation {automation.id} skipped: "
                    f"required stage={required_stage}, actual={actual_stage}"
                )
                return False

    # Add more trigger-specific logic here as needed

    return True


async def _execute_single_automation(
    db: AsyncSession,
    automation: Automation,
    trigger_key: str,
    candidate_id: UUID,
    job_id: UUID | None,
    metadata: dict | None,
) -> None:
    """
    Execute a single automation.

    Handles all actions and logs execution results.

    Args:
        db: Database session
        automation: Automation object
        trigger_key: Trigger identifier
        candidate_id: Candidate UUID
        job_id: Optional job UUID
        metadata: Optional trigger metadata
    """
    try:
        logger.info(f"Executing automation: {automation.name} (id={automation.id})")

        # Idempotency safeguard for noisy candidate/job assignment triggers.
        if trigger_key in {"candidate_applied", "candidate_job_assigned"}:
            dedupe_window_start = datetime.now(timezone.utc) - timedelta(minutes=2)
            existing_exec_result = await db.execute(
                select(AutomationExecution.id)
                .where(
                    AutomationExecution.automation_id == automation.id,
                    AutomationExecution.trigger_event == trigger_key,
                    AutomationExecution.candidate_id == candidate_id,
                    AutomationExecution.job_id == job_id,
                    AutomationExecution.status == "success",
                    AutomationExecution.created_at >= dedupe_window_start,
                )
                .limit(1)
            )
            if existing_exec_result.scalar_one_or_none() is not None:
                logger.info(
                    "Skipping duplicate automation execution automation_id=%s trigger=%s candidate_id=%s job_id=%s",
                    automation.id,
                    trigger_key,
                    candidate_id,
                    job_id,
                )
                return

        actions = automation.actions or []
        if not actions:
            logger.warning(f"Automation {automation.id} has no actions")
            await log_execution(
                db=db,
                automation_id=automation.id,
                org_id=automation.org_id,
                trigger_event=trigger_key,
                candidate_id=candidate_id,
                job_id=job_id,
                success=False,
                message="No actions configured",
            )
            return

        # Execute all actions
        all_success = True
        messages = []

        for idx, action in enumerate(actions):
            try:
                success, message = await execute_action(
                    db=db,
                    action=action,
                    candidate_id=candidate_id,
                    org_id=automation.org_id,
                    job_id=job_id,
                    metadata=metadata,
                )

                messages.append(f"Action {idx + 1}: {message}")

                if not success:
                    all_success = False
                    logger.warning(
                        f"Action {idx + 1} failed in automation {automation.id}: {message}"
                    )

            except Exception as e:
                all_success = False
                error_msg = f"Action {idx + 1} error: {str(e)}"
                messages.append(error_msg)
                logger.error(
                    f"Error executing action {idx + 1} in automation {automation.id}: {e}",
                    exc_info=True,
                )

        # Log execution
        combined_message = "; ".join(messages)
        await log_execution(
            db=db,
            automation_id=automation.id,
            org_id=automation.org_id,
            trigger_event=trigger_key,
            candidate_id=candidate_id,
            job_id=job_id,
            success=all_success,
            message=combined_message if not all_success else None,
        )

        # Update automation stats
        await update_automation_stats(db=db, automation_id=automation.id)

        if all_success:
            logger.info(f"Automation {automation.id} executed successfully")
        else:
            logger.warning(f"Automation {automation.id} completed with errors")

    except Exception as e:
        logger.error(f"Failed to execute automation {automation.id}: {e}", exc_info=True)
        # Log the failure
        await log_execution(
            db=db,
            automation_id=automation.id,
            org_id=automation.org_id,
            trigger_event=trigger_key,
            candidate_id=candidate_id,
            job_id=job_id,
            success=False,
            message=f"Execution error: {str(e)}",
        )
