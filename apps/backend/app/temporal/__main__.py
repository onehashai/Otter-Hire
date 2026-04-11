"""Run the Temporal worker: ``python -m app.temporal``."""

from __future__ import annotations

import asyncio
import logging

from app.core.logging import logger  # noqa: F401

import sentry  # noqa: F401

from app.temporal.worker import run_worker

if __name__ == "__main__":
    logging.getLogger("temporalio").setLevel(logging.INFO)
    logging.getLogger("temporalio.worker").setLevel(logging.INFO)
    logging.getLogger("temporalio.worker.workflow_sandbox").setLevel(logging.WARNING)
    asyncio.run(run_worker())
