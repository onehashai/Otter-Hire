from __future__ import annotations

import logging

import temporalio.exceptions

from app.temporal.client import get_temporal_client
from app.temporal.resume_scoring.types import ResumeScoreInput
from app.temporal.resume_scoring.workflow import ResumeScoreWorkflow

logger = logging.getLogger(__name__)

TASK_QUEUE = "resume-scoring"


async def enqueue_resume_score(input_data: ResumeScoreInput) -> dict[str, str | bool]:
    workflow_id = (
        f"resume-score-{input_data.candidate_id}-{input_data.job_id}-{input_data.generation}"
    )
    client = await get_temporal_client()
    try:
        handle = await client.start_workflow(
            ResumeScoreWorkflow.run,
            input_data,
            id=workflow_id,
            task_queue=TASK_QUEUE,
        )
        return {"workflow_id": str(handle.id), "started": True}
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        logger.info("Resume score workflow already running workflow_id=%s", workflow_id)
        return {"workflow_id": workflow_id, "started": False}
