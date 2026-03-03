"""Compatibility entrypoint for the migrated email integration Temporal worker."""

from __future__ import annotations

import asyncio
import logging

from app.integrations.app_store.email_integration.temporal.worker import run_worker


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
