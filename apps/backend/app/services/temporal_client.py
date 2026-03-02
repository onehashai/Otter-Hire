from __future__ import annotations

from temporalio.client import Client

from app.core.config import settings

_temporal_client: Client | None = None


async def get_temporal_client() -> Client:
    global _temporal_client
    if _temporal_client is None:
        _temporal_client = await Client.connect(
            settings.temporal_server_url,
            namespace=settings.temporal_namespace,
        )
    return _temporal_client
