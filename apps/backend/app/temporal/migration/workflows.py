from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.temporal.migration.types import AtsSyncInput, CommitBatchInput


@workflow.defn
class AtsSyncWorkflow:
    @workflow.run
    async def run(self, input_data: AtsSyncInput) -> dict:
        retry = RetryPolicy(
            initial_interval=timedelta(seconds=2),
            backoff_coefficient=2,
            maximum_interval=timedelta(minutes=2),
            maximum_attempts=5,
        )
        raw_records = await workflow.execute_activity(
            "fetch_candidates", input_data,
            start_to_close_timeout=timedelta(minutes=10), retry_policy=retry,
        )
        return await workflow.execute_activity(
            "validate_and_map_batch",
            {"integration_id": input_data.integration_id, "raw_records": raw_records, "source": "ats-sync"},
            start_to_close_timeout=timedelta(minutes=10), retry_policy=retry,
        )


@workflow.defn
class CommitBatchWorkflow:
    @workflow.run
    async def run(self, input_data: CommitBatchInput) -> dict:
        retry = RetryPolicy(
            initial_interval=timedelta(seconds=3),
            backoff_coefficient=2,
            maximum_interval=timedelta(minutes=2),
            maximum_attempts=4,
        )
        return await workflow.execute_activity(
            "commit_batch", input_data,
            start_to_close_timeout=timedelta(minutes=10), retry_policy=retry,
        )
