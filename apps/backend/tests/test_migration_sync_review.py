"""Sync prepares a review batch; only the approval route starts a commit."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from fastapi import HTTPException
from temporalio.client import WorkflowExecutionStatus

from app.api.v1.internal.endpoints import ats_migrations as routes


class SyncReviewTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.integration = SimpleNamespace(
            id=uuid4(), org_id=uuid4(), status="connected", provider_details={},
            mcp_connection_type=None, last_synced_at=None,
        )
        self.user = SimpleNamespace(org_id=self.integration.org_id)
        self.db = SimpleNamespace(execute=AsyncMock(), commit=AsyncMock())
        self.client = SimpleNamespace(start_workflow=AsyncMock(), get_workflow_handle=Mock())
        self.enabled = patch.object(routes, "_enabled")
        self.temporal = patch.object(routes, "get_temporal_client", AsyncMock(return_value=self.client))
        self.enabled.start()
        self.temporal.start()
        self.addCleanup(self.enabled.stop)
        self.addCleanup(self.temporal.stop)

    def results(self, *values):
        self.db.execute.side_effect = [Mock(scalar_one_or_none=Mock(return_value=v)) for v in values]

    async def test_new_sync_only_starts_fetch_workflow(self):
        self.results(self.integration, None)
        result = await routes.start_sync(self.integration.id, self.user, self.db)
        self.assertEqual(result["status"], "queued")
        self.assertIs(self.client.start_workflow.call_args.args[0], routes.AtsSyncWorkflow.run)
        self.assertEqual(self.integration.provider_details["sync_workflow_id"], result["workflow_id"])
        self.db.commit.assert_awaited_once()

    async def test_existing_pending_batch_is_returned_without_another_sync(self):
        batch_id = uuid4()
        self.results(self.integration, batch_id)
        result = await routes.start_sync(self.integration.id, self.user, self.db)
        self.assertEqual(result["batch_id"], str(batch_id))
        self.client.start_workflow.assert_not_awaited()

    async def test_running_sync_can_be_followed_after_reopening(self):
        self.integration.status = "syncing"
        self.integration.provider_details = {"sync_workflow_id": "existing-run"}
        self.results(self.integration)
        result = await routes.start_sync(self.integration.id, self.user, self.db)
        self.assertEqual(result["workflow_id"], "existing-run")
        self.client.start_workflow.assert_not_awaited()

    async def test_completed_sync_returns_its_exact_batch(self):
        self.results(self.integration)
        handle = SimpleNamespace(
            describe=AsyncMock(return_value=SimpleNamespace(status=WorkflowExecutionStatus.COMPLETED)),
            result=AsyncMock(return_value={"batch_id": "new-batch", "status": "pending_approval"}),
        )
        self.client.get_workflow_handle.return_value = handle
        result = await routes.sync_status(self.integration.id, f"ats-sync-{self.integration.id}-run", self.user, self.db)
        self.assertEqual(result["batch_id"], "new-batch")
        self.assertEqual(result["status"], "pending_approval")
        self.client.start_workflow.assert_not_awaited()

    async def test_failed_sync_reports_error(self):
        self.integration.provider_details = {"last_sync_error": "Provider access denied"}
        self.results(self.integration)
        self.client.get_workflow_handle.return_value = SimpleNamespace(
            describe=AsyncMock(return_value=SimpleNamespace(status=WorkflowExecutionStatus.FAILED)),
        )
        result = await routes.sync_status(self.integration.id, f"ats-sync-{self.integration.id}-run", self.user, self.db)
        self.assertEqual(result["error"], "Provider access denied")

    async def test_other_integrations_workflow_is_rejected(self):
        self.results(self.integration)
        with self.assertRaises(HTTPException) as error:
            await routes.sync_status(self.integration.id, f"ats-sync-{uuid4()}-run", self.user, self.db)
        self.assertEqual(error.exception.status_code, 404)
        self.client.get_workflow_handle.assert_not_called()

    async def test_other_organizations_integration_is_rejected(self):
        self.results(None)
        with self.assertRaises(HTTPException) as error:
            await routes.sync_status(self.integration.id, f"ats-sync-{self.integration.id}-run", self.user, self.db)
        self.assertEqual(error.exception.status_code, 404)
        statement = str(self.db.execute.call_args.args[0])
        self.assertIn("ats_integrations.org_id", statement)
        self.client.get_workflow_handle.assert_not_called()


if __name__ == "__main__":
    unittest.main()
