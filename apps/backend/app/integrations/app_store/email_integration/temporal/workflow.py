from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.integrations.app_store.email_integration.temporal.activities import (
        process_s3_inbound_email_activity,
        publish_update_activity,
    )
    from app.integrations.app_store.email_integration.temporal.types import InboundWorkflowInput


@workflow.defn
class InboundEmailWorkflow:
    @workflow.run
    async def run(self, input_data: InboundWorkflowInput) -> dict:
        retry = RetryPolicy(initial_interval=timedelta(seconds=2), maximum_attempts=3)

        result = await workflow.execute_activity(
            process_s3_inbound_email_activity,
            input_data,
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
                "candidate_id": result.get("candidate_id"),
                "inbound_email_id": result.get("inbound_email_id"),
                "org_id": result.get("org_id"),
                "workflow_id": workflow.info().workflow_id,
                "run_id": workflow.info().run_id,
                "occurred_at": workflow.now().isoformat(),
            },
            start_to_close_timeout=timedelta(seconds=30),
        )
        return result
