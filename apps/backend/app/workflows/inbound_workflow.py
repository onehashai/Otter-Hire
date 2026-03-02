from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.activities.inbound_activities import (
        download_email_activity,
        extract_resume_activity,
        parse_and_create_candidate_activity,
        publish_update_activity,
    )
    from app.workflows.types import InboundWorkflowInput


@workflow.defn
class InboundEmailWorkflow:
    @workflow.run
    async def run(self, input_data: InboundWorkflowInput) -> dict:
        retry = RetryPolicy(initial_interval=timedelta(seconds=2), maximum_attempts=3)

        raw_email_b64 = await workflow.execute_activity(
            download_email_activity,
            input_data,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=retry,
        )

        extracted = await workflow.execute_activity(
            extract_resume_activity,
            raw_email_b64,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=retry,
        )

        result = await workflow.execute_activity(
            parse_and_create_candidate_activity,
            {"data": extracted, "key": input_data.key},
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=retry,
        )

        await workflow.execute_activity(
            publish_update_activity,
            {
                "event": "inbound_processed",
                "key": input_data.key,
                "bucket": input_data.bucket,
                "status": result.get("status"),
                "http_status": result.get("http_status"),
                "inbox_address": result.get("inbox_address"),
            },
            start_to_close_timeout=timedelta(seconds=30),
        )
        return result
