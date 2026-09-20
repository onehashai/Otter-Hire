"""Durable, deduplicated processing of signed LinkedIn lead notifications."""

from datetime import timedelta

from temporalio import activity, workflow
from temporalio.common import RetryPolicy


@activity.defn
async def ingest_linkedin_lead(connection: str, event: dict) -> str:
    from fastapi import HTTPException
    from temporalio.exceptions import ApplicationError
    from app.db.session import AsyncSessionLocal
    from app.integrations.linkedin.leads import ingest_notification

    async with AsyncSessionLocal() as db:
        try:
            return await ingest_notification(db, connection, event)
        except HTTPException as exc:
            await db.rollback()
            from sqlalchemy import select
            from app.models.integration_credential import IntegrationCredential

            cred = (await db.execute(select(IntegrationCredential).where(
                IntegrationCredential.id == connection).with_for_update())).scalar_one_or_none()
            if cred and ((cred.config or {}).get("lead_subscription") or {}).get("owner") == event.get("owner"):
                cred.config = {**(cred.config or {}), "lead_sync_last_error": str(exc.detail)}
                await db.commit()
            raise ApplicationError(str(exc.detail), non_retryable=exc.status_code in (400, 403, 409, 422)) from exc


@workflow.defn
class LinkedInLeadWorkflow:
    @workflow.run
    async def run(self, connection: str, event: dict) -> str:
        return await workflow.execute_activity(
            ingest_linkedin_lead, args=[connection, event],
            start_to_close_timeout=timedelta(seconds=90),
            retry_policy=RetryPolicy(initial_interval=timedelta(seconds=10), maximum_attempts=8),
        )
