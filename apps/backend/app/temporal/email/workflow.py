from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError

with workflow.unsafe.imports_passed_through():
    from app.temporal.email.types import (
        InboundWorkflowInput,
        OutboundWorkflowInput,
    )


@workflow.defn
class InboundEmailWorkflow:
    @workflow.run
    async def run(self, input_data: InboundWorkflowInput) -> dict:
        if getattr(workflow.logger, "log_during_replay", None) is not None:
            workflow.logger.log_during_replay = True  # type: ignore[attr-defined]

        retry = RetryPolicy(
            initial_interval=timedelta(seconds=2),
            maximum_attempts=3,
        )

        workflow.logger.info(
            "Inbound workflow started workflow_id=%s run_id=%s bucket=%s key=%s",
            workflow.info().workflow_id,
            workflow.info().run_id,
            input_data.bucket,
            input_data.key,
        )

        result = await workflow.execute_activity(
            "process_s3_inbound_email_activity",
            input_data,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=retry,
        )

        workflow.logger.info(
            "Inbound workflow activity completed workflow_id=%s key=%s status=%s http_status=%s",
            workflow.info().workflow_id,
            input_data.key,
            result.get("status"),
            result.get("http_status"),
        )

        await workflow.execute_activity(
            "publish_update_activity",
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
            },
            start_to_close_timeout=timedelta(seconds=60),
        )

        workflow.logger.info(
            "Inbound workflow publish completed workflow_id=%s key=%s",
            workflow.info().workflow_id,
            input_data.key,
        )
        return result


@workflow.defn
class OutboundEmailWorkflow:
    @workflow.run
    async def run(self, input_data: OutboundWorkflowInput) -> dict:
        if getattr(workflow.logger, "log_during_replay", None) is not None:
            workflow.logger.log_during_replay = True  # type: ignore[attr-defined]

        workflow.logger.info(
            "Outbound workflow started workflow_id=%s run_id=%s message_id=%s to=%s",
            workflow.info().workflow_id,
            workflow.info().run_id,
            input_data.message_id,
            input_data.to_email,
        )

        send_retry = RetryPolicy(
            initial_interval=timedelta(seconds=5),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=5),
            maximum_attempts=3,
        )

        try:
            result = await workflow.execute_activity(
                "send_outbound_email_activity",
                input_data,
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=send_retry,
            )
            workflow.logger.info(
                "Outbound workflow send completed workflow_id=%s message_id=%s status=%s",
                workflow.info().workflow_id,
                input_data.message_id,
                result.get("status"),
            )
            return result

        except ActivityError:
            workflow.logger.warning(
                "Outbound workflow send failed after retries workflow_id=%s message_id=%s",
                workflow.info().workflow_id,
                input_data.message_id,
            )

            await workflow.execute_activity(
                "mark_message_failed_activity",
                input_data.message_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )

            return {"status": "failed", "message_id": input_data.message_id}
