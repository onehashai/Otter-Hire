from __future__ import annotations

import logging
from datetime import timedelta

import temporalio.exceptions

from app.integrations.app_store.email_integration.temporal.types import (
    InboundWorkflowInput,
    OutboundWorkflowInput,
)
from app.integrations.app_store.email_integration.temporal.workflow import (
    InboundEmailWorkflow,
    OutboundEmailWorkflow,
)
from app.services.temporal_client import get_temporal_client

logger = logging.getLogger(__name__)


async def enqueue_ses_raw_key(bucket: str, key: str) -> dict[str, str | bool]:
    workflow_id = f"inbound-{key.replace('/', '-')[:180]}"
    logger.info(
        "Inbound workflow start requested bucket=%s key=%s workflow_id=%s namespace=%s task_queue=%s",
        bucket,
        key,
        workflow_id,
        "default",
        "email-inbound",
    )
    client = await get_temporal_client()
    try:
        handle = await client.start_workflow(
            InboundEmailWorkflow.run,
            InboundWorkflowInput(bucket=bucket, key=key),
            id=workflow_id,
            task_queue="email-inbound",
        )
        logger.info(
            "Inbound workflow start succeeded bucket=%s key=%s workflow_id=%s",
            bucket,
            key,
            handle.id,
        )
        return {"workflow_id": str(handle.id), "started": True}
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        # SNS can deliver the same S3 event multiple times; workflow already running/completed
        logger.info(
            "Inbound workflow already started bucket=%s key=%s workflow_id=%s",
            bucket,
            key,
            workflow_id,
        )
        return {"workflow_id": workflow_id, "started": False}
    except Exception:
        logger.exception(
            "Inbound workflow start failed bucket=%s key=%s workflow_id=%s",
            bucket,
            key,
            workflow_id,
        )
        raise


async def enqueue_outbound_email(input_data: OutboundWorkflowInput) -> str:
    """Start an OutboundEmailWorkflow for a single message.

    Workflow ID is deterministic on message_id so duplicate enqueues are safe.
    """
    client = await get_temporal_client()
    workflow_id = f"outbound-{input_data.message_id}"
    try:
        handle = await client.start_workflow(
            OutboundEmailWorkflow.run,
            input_data,
            id=workflow_id,
            task_queue="email-outbound",
        )
        return str(handle.id)
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        return workflow_id
