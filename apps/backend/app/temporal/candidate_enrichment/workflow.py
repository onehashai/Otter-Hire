"""Temporal workflow for candidate avatar and profile enrichment."""

from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.temporal.candidate_enrichment.types import CandidateEnrichmentInput


@workflow.defn
class CandidateEnrichmentWorkflow:
    @workflow.run
    async def run(self, input_data: CandidateEnrichmentInput) -> dict:
        result: dict = {}
        # HTTP 429 is an expected provider response, not an activity exception.
        # wait_condition provides a durable timer in the pinned Temporal SDK.
        retry_attempt = 0
        while True:
            result = await workflow.execute_activity(
                "enrich_candidate_profile_activity",
                input_data,
                start_to_close_timeout=timedelta(minutes=3),
                retry_policy=RetryPolicy(
                    initial_interval=timedelta(seconds=5),
                    backoff_coefficient=2.0,
                    maximum_interval=timedelta(minutes=1),
                    maximum_attempts=3,
                ),
            )
            if result.get("avatar_state") != "rate_limited":
                return result
            retry_attempt += 1
            if retry_attempt % 20 == 0:
                workflow.continue_as_new(input_data)
            retry_after = int(result.get("retry_after_seconds") or 0)
            try:
                await workflow.wait_condition(
                    lambda: False,
                    timeout=timedelta(seconds=max(1, min(retry_after, 3600))),
                )
            except TimeoutError:
                pass
        return result
