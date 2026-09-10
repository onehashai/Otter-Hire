from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.services.migration.config_loader import ConnectorConfig, get_path


class ConnectorFetchError(RuntimeError):
    pass


class GenericFetcher:
    def __init__(self, config: ConnectorConfig, secret: str | None = None):
        self.config = config
        self.secret = secret
        self._last_request = 0.0

    def _headers(self) -> dict[str, str]:
        auth = self.config.auth
        if not self.secret or auth.type == "none":
            return {}
        if auth.type == "bearer" or auth.type == "oauth2":
            return {auth.header_name: f"Bearer {self.secret}"}
        if auth.type == "api_key":
            return {auth.header_name: self.secret}
        if auth.type == "basic":
            value = self.secret if ":" in self.secret else f"{self.secret}:"
            return {"Authorization": f"Basic {base64.b64encode(value.encode()).decode()}"}
        return {}

    async def _request(self, client: httpx.AsyncClient, endpoint_path: str, params: dict[str, Any]) -> httpx.Response:
        interval = 1 / self.config.rate_limits.requests_per_second
        delay = interval - (asyncio.get_running_loop().time() - self._last_request)
        if delay > 0:
            await asyncio.sleep(delay)
        for attempt in range(self.config.rate_limits.max_retries + 1):
            response = await client.get(endpoint_path, params=params, headers=self._headers())
            self._last_request = asyncio.get_running_loop().time()
            if response.status_code < 400:
                return response
            if response.status_code not in (429, 500, 502, 503, 504) or attempt >= self.config.rate_limits.max_retries:
                raise ConnectorFetchError(f"source request failed with HTTP {response.status_code}")
            await asyncio.sleep(self.config.rate_limits.backoff_seconds * (2**attempt))
        raise ConnectorFetchError("source request exhausted retries")

    async def records(self, resource: str, checkpoint: dict[str, Any] | None = None, since: str | None = None) -> AsyncIterator[dict[str, Any]]:
        endpoint = self.config.endpoints[resource]
        state = checkpoint or {}
        page = int(state.get("page", 1))
        cursor = state.get("cursor")
        async with httpx.AsyncClient(base_url=self.config.base_url, timeout=30) as client:
            while True:
                params: dict[str, Any] = {}
                pagination = self.config.pagination
                if since and pagination.since_param_name:
                    params[pagination.since_param_name] = since
                if pagination.style == "cursor" and cursor:
                    params[pagination.cursor_request_param] = cursor
                elif pagination.style == "offset":
                    params[pagination.page_param] = state.get("offset", 0)
                    params[pagination.page_size_param] = pagination.page_size
                elif pagination.style == "page":
                    params[pagination.page_param] = page
                    params[pagination.page_size_param] = pagination.page_size
                response = await self._request(client, endpoint.path, params)
                payload = response.json()
                items = get_path(payload, endpoint.response_root_key) if endpoint.response_root_key else payload
                if not isinstance(items, list):
                    raise ConnectorFetchError(f"{resource} response did not contain a list")
                for item in items:
                    if isinstance(item, dict):
                        yield item
                if not items:
                    return
                if pagination.style == "none":
                    return
                if pagination.style == "page":
                    page += 1
                elif pagination.style == "offset":
                    state["offset"] = int(state.get("offset", 0)) + len(items)
                elif pagination.style == "cursor":
                    cursor = get_path(payload, pagination.cursor_response_path)
                    if not cursor:
                        return
