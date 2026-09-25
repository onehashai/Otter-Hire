"""Enqueue durable candidate enrichment workflows."""

from __future__ import annotations

from uuid import uuid4

import temporalio.exceptions

from app.temporal.candidate_enrichment.types import CandidateEnrichmentInput
from app.temporal.candidate_enrichment.workflow import CandidateEnrichmentWorkflow
from app.temporal.client import get_temporal_client

TASK_QUEUE = "candidate-enrichment"


async def enqueue_candidate_enrichment(
    *, input_data: CandidateEnrichmentInput, force: bool = False
) -> dict[str, str | bool]:
    workflow_id = f"candidate-enrichment-{input_data.candidate_id}"
    if force:
        workflow_id = f"{workflow_id}-refresh-{uuid4()}"
    client = await get_temporal_client()
    try:
        handle = await client.start_workflow(
            CandidateEnrichmentWorkflow.run,
            input_data,
            id=workflow_id,
            task_queue=TASK_QUEUE,
        )
        return {"workflow_id": str(handle.id), "started": True}
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        return {"workflow_id": workflow_id, "started": False}
