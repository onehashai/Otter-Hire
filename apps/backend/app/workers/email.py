from __future__ import annotations

import asyncio
import logging

from temporalio.worker import Worker

from app.core.config import settings
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

logger = logging.getLogger("ats_worker")


async def run_worker() -> None:
    try:
        logger.info(
            "[WORKER] Connecting to Temporal server=%s namespace=%s",
            settings.temporal_server_url,
            settings.temporal_namespace,
        )
        client = await get_temporal_client()
        logger.info("[WORKER] Connected to Temporal successfully")

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
            "[WORKER] Started task_queues=email-inbound,email-outbound namespace=%s",
            settings.temporal_namespace,
        )
        logger.info("[WORKER] Polling for tasks...")

        async def _keepalive() -> None:
            while True:
                await asyncio.sleep(60)
                logger.info("[WORKER] Alive, polling email-inbound, email-outbound")

        await asyncio.gather(
            worker_inbound.run(),
            worker_outbound.run(),
            _keepalive(),
        )
    except Exception as e:
        logger.error(f"Worker failed to start: {type(e).__name__}: {e}", exc_info=True)
        raise
