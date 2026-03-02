from __future__ import annotations

from app.core.config import settings
from app.services.temporal_client import get_temporal_client
from app.workflows.inbound_workflow import InboundEmailWorkflow
from app.workflows.types import InboundWorkflowInput


async def enqueue_ses_raw_key(bucket: str, key: str) -> str:
    client = await get_temporal_client()
    workflow_id = f"inbound-{key.replace('/', '-')[:180]}"
    handle = await client.start_workflow(
        InboundEmailWorkflow.run,
        InboundWorkflowInput(bucket=bucket, key=key),
        id=workflow_id,
        task_queue=settings.temporal_task_queue,
    )
    return str(handle.id)
