"""Successful retries must not keep an earlier database failure on the batch."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.session import engine
from app.services.migration.batch_service import commit_batch


class DatabaseRecoveryTests(unittest.IsolatedAsyncioTestCase):
    @unittest.skipUnless(os.getenv("ATS_TEST_DB_RECOVERY") == "1", "staging-only database check")
    async def test_reconnects_after_own_idle_test_connection_is_terminated(self):
        # Use isolated pools and terminate only the idle connection this test created.
        pool = create_async_engine(
            settings.database_url, pool_size=1, max_overflow=0,
            pool_pre_ping=engine.sync_engine.pool._pre_ping,
        )
        control = create_async_engine(settings.database_url, poolclass=NullPool)
        try:
            async with pool.connect() as connection:
                original_pid = await connection.scalar(text("SELECT pg_backend_pid()"))
            async with control.connect() as connection:
                terminated = await connection.scalar(
                    text("SELECT pg_terminate_backend(:pid, 5000)"), {"pid": original_pid}
                )
                self.assertTrue(terminated)
            async with pool.connect() as connection:
                new_pid = await connection.scalar(text("SELECT pg_backend_pid()"))
                self.assertNotEqual(new_pid, original_pid)
                self.assertEqual(await connection.scalar(text("SELECT 1")), 1)
        finally:
            await pool.dispose()
            await control.dispose()

    def test_pool_checks_connections_before_checkout(self):
        self.assertTrue(engine.sync_engine.pool._pre_ping)

    async def test_successful_retry_clears_stale_error(self):
        batch = SimpleNamespace(
            id=uuid4(), status="failed", rows=[],
            error_reason="AdminShutdown: terminating connection due to administrator command",
            integration=SimpleNamespace(last_synced_at=None),
        )
        db = SimpleNamespace(add=Mock(), commit=AsyncMock())
        result = await commit_batch(db, batch, uuid4())
        self.assertEqual(batch.status, "completed")
        self.assertIsNone(batch.error_reason)
        self.assertEqual(result["unresolved_errors"], 0)
        db.commit.assert_awaited_once()

    async def test_row_errors_survive_but_stale_batch_error_is_cleared(self):
        row = SimpleNamespace(
            entity_type="candidate", row_number=1, row_status="error",
            error_reason="Missing required email", mapped_payload=None,
        )
        batch = SimpleNamespace(
            id=uuid4(), status="failed", rows=[row], error_reason="AdminShutdown",
            integration=SimpleNamespace(last_synced_at=None),
        )
        db = SimpleNamespace(add=Mock(), commit=AsyncMock())
        result = await commit_batch(db, batch, uuid4())
        self.assertEqual(batch.status, "completed_with_flags")
        self.assertIsNone(batch.error_reason)
        self.assertEqual(row.error_reason, "Missing required email")
        self.assertEqual(result["unresolved_errors"], 1)


if __name__ == "__main__":
    unittest.main()
