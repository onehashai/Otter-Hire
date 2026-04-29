from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.temporal.resume_scoring.types import ResumeScoreInput


@workflow.defn
class ResumeScoreWorkflow:
    @workflow.run
    async def run(self, input_data: ResumeScoreInput) -> dict:
        if getattr(workflow.logger, "log_during_replay", None) is not None:
            workflow.logger.log_during_replay = True  # type: ignore[attr-defined]

        retry = RetryPolicy(
            initial_interval=timedelta(seconds=3),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=2),
            maximum_attempts=4,
        )

        return await workflow.execute_activity(
            "score_candidate_job_activity",
            input_data,
            start_to_close_timeout=timedelta(minutes=3),
            retry_policy=retry,
        )
