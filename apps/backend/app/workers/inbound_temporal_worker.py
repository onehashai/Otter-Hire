from __future__ import annotations

import asyncio
import logging

from temporalio.worker import Worker

from app.activities.inbound_activities import (
    download_email_activity,
    extract_resume_activity,
    parse_and_create_candidate_activity,
    publish_update_activity,
)
from app.core.config import settings
from app.services.temporal_client import get_temporal_client
from app.workflows.inbound_workflow import InboundEmailWorkflow

logger = logging.getLogger(__name__)


async def run_worker() -> None:
    client = await get_temporal_client()
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[InboundEmailWorkflow],
        activities=[
            download_email_activity,
            extract_resume_activity,
            parse_and_create_candidate_activity,
            publish_update_activity,
        ],
    )
    logger.info("Temporal inbound worker started task_queue=%s", settings.temporal_task_queue)
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
