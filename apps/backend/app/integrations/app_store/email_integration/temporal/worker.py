from __future__ import annotations

import asyncio
import logging

from temporalio.worker import Worker

from app.core.config import settings
from app.integrations.app_store.email_integration.temporal.activities import (
    download_and_extract_resume_activity,
    download_email_activity,
    extract_resume_activity,
    parse_and_create_candidate_activity,
    process_s3_inbound_email_activity,
    publish_update_activity,
)
from app.integrations.app_store.email_integration.temporal.workflow import InboundEmailWorkflow
from app.services.temporal_client import get_temporal_client

logger = logging.getLogger(__name__)


async def run_worker() -> None:
    client = await get_temporal_client()
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[InboundEmailWorkflow],
        activities=[
            download_and_extract_resume_activity,
            download_email_activity,
            extract_resume_activity,
            parse_and_create_candidate_activity,
            process_s3_inbound_email_activity,
            publish_update_activity,
        ],
        max_concurrent_activities=50,
        max_concurrent_workflow_tasks=20,
    )
    logger.info("Temporal inbound worker started task_queue=%s", settings.temporal_task_queue)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
