"""Temporal workflow: durable post–job-apply resume parsing."""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.temporal.resume_parsing.types import JobApplyResumeParseInput


@workflow.defn
class JobApplyResumeParseWorkflow:
    @workflow.run
    async def run(self, input_data: JobApplyResumeParseInput) -> dict:
        if getattr(workflow.logger, "log_during_replay", None) is not None:
            workflow.logger.log_during_replay = True  # type: ignore[attr-defined]

        workflow.logger.info(
            "JobApplyResumeParseWorkflow started workflow_id=%s candidate_id=%s",
            workflow.info().workflow_id,
            input_data.candidate_id,
        )

        retry = RetryPolicy(
            initial_interval=timedelta(seconds=3),
            backoff_coefficient=2.0,
            maximum_interval=timedelta(minutes=2),
            maximum_attempts=5,
        )

        result = await workflow.execute_activity(
            "parse_job_apply_resume_activity",
            input_data,
            start_to_close_timeout=timedelta(minutes=8),
            retry_policy=retry,
        )

        workflow.logger.info(
            "JobApplyResumeParseWorkflow completed workflow_id=%s status=%s",
            workflow.info().workflow_id,
            result.get("status"),
        )
        return result
