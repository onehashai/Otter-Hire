from __future__ import annotations

import temporalio.exceptions

from app.core.config import settings
from app.services.ses_bridge import _mark_key_enqueued_in_redis
from app.services.temporal_client import get_temporal_client
from app.workflows.inbound_workflow import InboundEmailWorkflow
from app.workflows.types import InboundWorkflowInput


async def enqueue_ses_raw_key(bucket: str, key: str) -> str:
    client = await get_temporal_client()
    workflow_id = f"inbound-{key.replace('/', '-')[:180]}"
    try:
        handle = await client.start_workflow(
            InboundEmailWorkflow.run,
            InboundWorkflowInput(bucket=bucket, key=key),
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        )
        _mark_key_enqueued_in_redis(key)
        return str(handle.id)
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        # SNS can deliver the same S3 event multiple times; workflow already running/completed
        _mark_key_enqueued_in_redis(key)
        return workflow_id
