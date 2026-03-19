from __future__ import annotations

import asyncio
from app.core.logging import logger

from temporalio.worker import Worker

from app.integrations.app_store.email_integration.temporal.activities import (
    download_and_extract_resume_activity,
    download_email_activity,
    extract_resume_activity,
    mark_message_failed_activity,
    parse_and_create_candidate_activity,
    process_s3_inbound_email_activity,
    publish_update_activity,
    send_outbound_email_activity,
)
from app.integrations.app_store.email_integration.temporal.workflow import (
    InboundEmailWorkflow,
    OutboundEmailWorkflow,
)
from app.services.temporal_client import get_temporal_client

async def run_worker() -> None:
    try:
        logger.info("Attempting to connect to Temporal...")
        client = await get_temporal_client()
        logger.info(f"Connected to Temporal successfully: {client}")

        worker_inbound = Worker(
            client,
            task_queue="email-inbound",
            workflows=[InboundEmailWorkflow],
            activities=[
                download_and_extract_resume_activity,
                download_email_activity,
                extract_resume_activity,
                parse_and_create_candidate_activity,
                process_s3_inbound_email_activity,
                publish_update_activity,
            ],
            max_concurrent_activities=20,
            max_concurrent_workflow_tasks=5,
        )
        worker_outbound = Worker(
            client,
            task_queue="email-outbound",
            workflows=[OutboundEmailWorkflow],
            activities=[
                send_outbound_email_activity,
                mark_message_failed_activity,
            ],
            max_concurrent_activities=20,
            max_concurrent_workflow_tasks=5,
        )
        logger.info(
            "Temporal email workers started task_queues=%s,%s",
            "email-inbound",
            "email-outbound",
        )
        logger.info("Starting worker polling...")
        await asyncio.gather(worker_inbound.run(), worker_outbound.run())
    except Exception as e:
        logger.error(f"Worker failed to start: {type(e).__name__}: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(run_worker())
