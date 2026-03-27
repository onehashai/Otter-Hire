"""Temporal client singleton (namespace connection)."""

from __future__ import annotations

import asyncio
import logging

from temporalio.client import Client

from app.core.config import settings

_temporal_client: Client | None = None
logger = logging.getLogger(__name__)

_CONNECT_INITIAL_DELAY_SECONDS = 1
_CONNECT_MAX_DELAY_SECONDS = 30


async def get_temporal_client() -> Client:
    global _temporal_client
    if _temporal_client is None:
        delay = _CONNECT_INITIAL_DELAY_SECONDS
        while True:
            try:
                logger.info(
                    "Temporal client connect start server=%s namespace=%s",
                    settings.temporal_server_url,
                    settings.temporal_namespace,
                )
                _temporal_client = await Client.connect(
                    settings.temporal_server_url,
                    namespace=settings.temporal_namespace,
                )
                logger.info(
                    "Temporal client connected server=%s namespace=%s",
                    settings.temporal_server_url,
                    settings.temporal_namespace,
                )
                break
            except Exception:
                logger.exception(
                    "Temporal client connect failed server=%s namespace=%s retry_in=%ss",
                    settings.temporal_server_url,
                    settings.temporal_namespace,
                    delay,
                )
                await asyncio.sleep(delay)
                delay = min(delay * 2, _CONNECT_MAX_DELAY_SECONDS)
    return _temporal_client
