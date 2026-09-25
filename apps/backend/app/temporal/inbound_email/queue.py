from __future__ import annotations

import logging
from uuid import uuid4

import temporalio.exceptions

from app.temporal.client import get_temporal_client
from app.temporal.inbound_email.types import InboundEmailParseInput
from app.temporal.inbound_email.workflow import InboundEmailParseWorkflow

logger = logging.getLogger(__name__)

TASK_QUEUE = "inbound-email-parse"


async def enqueue_inbound_email_parse(
    *,
    inbound_email_id: str,
    input_data: InboundEmailParseInput,
    force: bool = False,
) -> dict[str, str | bool]:
    """Start a durable parse workflow, optionally as an explicit retry."""
    workflow_id = f"inbound-email-parse-{inbound_email_id}"
    if force:
        workflow_id = f"{workflow_id}-retry-{uuid4()}"
    client = await get_temporal_client()
    try:
        handle = await client.start_workflow(
            InboundEmailParseWorkflow.run,
            input_data,
            id=workflow_id,
            task_queue=TASK_QUEUE,
        )
        logger.info(
            "Inbound email parse workflow started workflow_id=%s inbound_email_id=%s",
            handle.id,
            inbound_email_id,
        )
        return {"workflow_id": str(handle.id), "started": True}
    except temporalio.exceptions.WorkflowAlreadyStartedError:
        logger.info(
            "Inbound email parse workflow already running workflow_id=%s",
            workflow_id,
        )
        return {"workflow_id": workflow_id, "started": False}
    except Exception:
        logger.exception(
            "Inbound email parse workflow start failed workflow_id=%s",
            workflow_id,
        )
        raise
