"""Enqueue job-apply resume parsing workflows."""

from __future__ import annotations

import logging

import temporalio.exceptions

from app.temporal.client import get_temporal_client
from app.temporal.resume_parsing.types import JobApplyResumeParseInput
from app.temporal.resume_parsing.workflow import JobApplyResumeParseWorkflow

logger = logging.getLogger(__name__)

TASK_QUEUE = "careers-resume-parse"


async def enqueue_job_apply_resume_parse(
    *,
    application_id: str,
    input_data: JobApplyResumeParseInput,
) -> dict[str, str | bool]:
    """Start a durable parse workflow. Idempotent per application_id."""
    workflow_id = f"job-apply-resume-{application_id}"
    client = await get_temporal_client()
    try:
        handle = await client.start_workflow(
            JobApplyResumeParseWorkflow.run,
            input_data,
            id=workflow_id,
            task_queue=TASK_QUEUE,
        )
        logger.info(
            "Job apply resume parse workflow started workflow_id=%s candidate_id=%s",
            handle.id,
            input_data.candidate_id,
        )
        return {"workflow_id": str(handle.id), "started": True}
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        logger.info(
            "Job apply resume parse workflow already running workflow_id=%s",
            workflow_id,
        )
        return {"workflow_id": workflow_id, "started": False}
    except Exception:
        logger.exception(
            "Job apply resume parse workflow start failed workflow_id=%s",
            workflow_id,
        )
        raise
