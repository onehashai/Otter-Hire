from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.temporal.inbound_email.types import InboundEmailParseInput


@workflow.defn
class InboundEmailParseWorkflow:
    @workflow.run
    async def run(self, input_data: InboundEmailParseInput) -> dict:
        if getattr(workflow.logger, "log_during_replay", None) is not None:
            workflow.logger.log_during_replay = True  # type: ignore[attr-defined]

        workflow.logger.info(
            "InboundEmailParseWorkflow started workflow_id=%s inbound_email_id=%s",
            workflow.info().workflow_id,
            input_data.inbound_email_id,
        )

        retry = RetryPolicy(
            initial_interval=timedelta(seconds=5),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=2),
            maximum_attempts=5,
        )

        result = await workflow.execute_activity(
            "parse_inbound_email_activity",
            input_data,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=retry,
        )

        workflow.logger.info(
            "InboundEmailParseWorkflow completed workflow_id=%s status=%s",
            workflow.info().workflow_id,
            result.get("status"),
        )
        return result
