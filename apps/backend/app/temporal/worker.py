"""Temporal worker process: polls task queues for all registered workflows/activities."""

from __future__ import annotations

import asyncio
import logging

from temporalio.worker import Worker

from app.core.config import settings
from app.services.esco_loader import load_esco_into_redis
from app.temporal.client import get_temporal_client
from app.temporal.email.activities import (
    download_and_extract_resume_activity,
    download_email_activity,
    extract_resume_activity,
    mark_message_failed_activity,
    parse_and_create_candidate_activity,
    process_s3_inbound_email_activity,
    publish_update_activity,
    send_outbound_email_activity,
)
from app.temporal.email.workflow import (
    InboundEmailWorkflow,
    OutboundEmailWorkflow,
)
from app.temporal.migration.activities import (
    commit_batch_activity,
    fetch_candidates,
    send_import_complete_email_activity,
    transfer_resume_attachment,
    validate_and_map_batch,
)
from app.temporal.migration.workflows import AtsSyncWorkflow, CommitBatchWorkflow
from app.temporal.resume_parsing.activities import parse_job_apply_resume_activity
from app.temporal.resume_parsing.workflow import JobApplyResumeParseWorkflow
from app.temporal.resume_scoring.activities import score_candidate_job_activity
from app.temporal.resume_scoring.workflow import ResumeScoreWorkflow
from app.temporal.sentry_interceptor import SentryInterceptor

logger = logging.getLogger("ats_worker")


async def run_temporal_worker() -> None:
    try:
        logger.info(
            "[WORKER] Connecting to Temporal server=%s namespace=%s",
            settings.temporal_server_url,
            settings.temporal_namespace,
        )
        client = await get_temporal_client()
        logger.info("[WORKER] Connected to Temporal successfully")

        # load ESCO taxonomy into Redis (no-op if already loaded)
        await load_esco_into_redis()
        logger.info("[WORKER] ESCO taxonomy ready")

        _sentry_interceptors = [SentryInterceptor()]

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
            interceptors=_sentry_interceptors,
            max_concurrent_activities=20,
            max_concurrent_workflow_tasks=5,
        )
        # Import the inbound-email-parse workflow & activity
        from app.temporal.inbound_email.activities import parse_inbound_email_activity
        from app.temporal.inbound_email.workflow import InboundEmailParseWorkflow

        worker_inbound_parse = Worker(
            client,
            task_queue="inbound-email-parse",
            workflows=[InboundEmailParseWorkflow],
            activities=[parse_inbound_email_activity],
            interceptors=_sentry_interceptors,
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
            interceptors=_sentry_interceptors,
            max_concurrent_activities=20,
            max_concurrent_workflow_tasks=5,
        )
        worker_careers_resume = Worker(
            client,
            task_queue="careers-resume-parse",
            workflows=[JobApplyResumeParseWorkflow],
            activities=[parse_job_apply_resume_activity],
            interceptors=_sentry_interceptors,
            max_concurrent_activities=10,
            max_concurrent_workflow_tasks=10,
        )
        worker_resume_scoring = Worker(
            client,
            task_queue="resume-scoring",
            workflows=[ResumeScoreWorkflow],
            activities=[score_candidate_job_activity],
            interceptors=_sentry_interceptors,
            max_concurrent_activities=10,
            max_concurrent_workflow_tasks=10,
        )
        migration_workers = []
        if settings.ats_auto_import_enabled:
            migration_workers.append(
                Worker(
                    client,
                    task_queue="ats-migration",
                    workflows=[AtsSyncWorkflow, CommitBatchWorkflow],
                    activities=[
                        fetch_candidates,
                        validate_and_map_batch,
                        commit_batch_activity,
                        send_import_complete_email_activity,
                        transfer_resume_attachment,
                    ],
                    interceptors=_sentry_interceptors,
                    max_concurrent_activities=5,
                    max_concurrent_workflow_tasks=5,
                )
            )
        queues = "email-inbound,inbound-email-parse,email-outbound,careers-resume-parse,resume-scoring"
        if settings.ats_auto_import_enabled:
            queues += ",ats-migration"
        logger.info("[WORKER] Started task_queues=%s namespace=%s", queues, settings.temporal_namespace)
        logger.info("[WORKER] Polling for tasks...")

        async def _keepalive() -> None:
            while True:
                await asyncio.sleep(60)
                logger.info("[WORKER] Alive, polling %s", queues)

        await asyncio.gather(
            worker_inbound.run(),
            worker_inbound_parse.run(),
            worker_outbound.run(),
            worker_careers_resume.run(),
            worker_resume_scoring.run(),
            *(worker.run() for worker in migration_workers),
            _keepalive(),
        )
    except Exception as e:
        logger.error(f"Worker failed to start: {type(e).__name__}: {e}", exc_info=True)
        raise


run_worker = run_temporal_worker
