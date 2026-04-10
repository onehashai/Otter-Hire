"""Temporal activity interceptor that reports failures to Sentry.

Workflows run inside a deterministic sandbox and cannot use external SDKs
directly, so we only intercept activities (which run outside the sandbox).

Usage — register in every Worker() constructor:
    from app.temporal.sentry_interceptor import SentryInterceptor
    Worker(client, task_queue="...", interceptors=[SentryInterceptor()])
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import sentry_sdk
from temporalio import activity
from temporalio.exceptions import ApplicationError
from temporalio.worker import ActivityInboundInterceptor, ExecuteActivityInput, Interceptor

if TYPE_CHECKING:
    pass


class _SentryActivityInterceptor(ActivityInboundInterceptor):
    """Wraps each activity execution with a Sentry scope carrying Temporal tags."""

    async def execute_activity(self, input: ExecuteActivityInput):  # type: ignore[override]
        info = activity.info()

        # Set tags on the current scope so they appear on any exception or
        # transaction captured during this activity execution.
        sentry_sdk.set_tag("temporal.activity_type", info.activity_type)
        sentry_sdk.set_tag("temporal.workflow_id", info.workflow_id)
        sentry_sdk.set_tag("temporal.workflow_run_id", info.workflow_run_id)
        sentry_sdk.set_tag("temporal.task_queue", info.task_queue)
        sentry_sdk.set_tag("temporal.attempt", str(info.attempt))

        try:
            return await super().execute_activity(input)
        except Exception as exc:
            # Capture only terminal failures to avoid retry noise.
            # NOTE: temporalio==1.7.0 activity info does not expose retry_policy
            # as a typed attribute in all contexts, so guard access via getattr.
            retry_policy = getattr(info, "retry_policy", None)
            max_attempts = (
                getattr(retry_policy, "maximum_attempts", None)
                if retry_policy is not None
                else None
            )
            is_last_attempt = (
                isinstance(max_attempts, int) and max_attempts > 0 and info.attempt >= max_attempts
            )
            is_non_retryable = isinstance(exc, ApplicationError) and bool(exc.non_retryable)

            if is_last_attempt or is_non_retryable:
                sentry_sdk.capture_exception(exc)
            raise


class SentryInterceptor(Interceptor):
    """Temporal Interceptor — register once per Worker instance."""

    def intercept_activity(self, next: ActivityInboundInterceptor) -> ActivityInboundInterceptor:
        return _SentryActivityInterceptor(next)
