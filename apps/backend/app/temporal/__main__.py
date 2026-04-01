"""Run the Temporal worker: ``python -m app.temporal``."""

from __future__ import annotations

import asyncio
import logging

from app.core.logging import setup_logging
from app.temporal.worker import run_worker

if __name__ == "__main__":
    setup_logging()
    logging.getLogger("temporalio").setLevel(logging.INFO)
    logging.getLogger("temporalio.worker").setLevel(logging.INFO)
    logging.getLogger("temporalio.worker.workflow_sandbox").setLevel(logging.WARNING)
    asyncio.run(run_worker())
