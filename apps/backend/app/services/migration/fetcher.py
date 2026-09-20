from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx

from app.services.migration.config_loader import ConnectorConfig, get_path


class ConnectorFetchError(RuntimeError):
    pass


def build_auth_headers(config: ConnectorConfig, secret: str | None) -> dict[str, str]:
    auth = config.auth
    if not secret or auth.type == "none":
        return {}
    if auth.type in {"bearer", "oauth2"}:
        return {auth.header_name: f"Bearer {secret}"}
    if auth.type == "api_key":
        return {auth.header_name: secret}
    if auth.type == "basic":
        value = secret if ":" in secret else f"{secret}:"
        return {"Authorization": f"Basic {base64.b64encode(value.encode()).decode()}"}
    return {}


def _format_since(value: str, date_format: str | None) -> str:
    if not date_format:
        return value
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ConnectorFetchError("sync checkpoint is not a valid ISO timestamp") from exc
    if date_format == "unix_ms":
        return str(int(parsed.timestamp() * 1000))
    return parsed.strftime(date_format)


class GenericFetcher:
    def __init__(
        self,
        config: ConnectorConfig,
        secret: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.config = config
        self.secret = secret
        self.transport = transport
        self._last_request = 0.0

    def _headers(self) -> dict[str, str]:
        return build_auth_headers(self.config, self.secret)

    async def _request(
        self,
        client: httpx.AsyncClient,
        method: str,
        endpoint_path: str,
        params: dict[str, Any] | None,
    ) -> httpx.Response:
        interval = 1 / self.config.rate_limits.requests_per_second
        delay = interval - (asyncio.get_running_loop().time() - self._last_request)
        if delay > 0:
            await asyncio.sleep(delay)
        for attempt in range(self.config.rate_limits.max_retries + 1):
            response = await client.request(
                method,
                endpoint_path,
                params=params,
                headers=self._headers(),
            )
            self._last_request = asyncio.get_running_loop().time()
            if response.status_code < 400:
                return response
            if (
                response.status_code not in (429, 500, 502, 503, 504)
                or attempt >= self.config.rate_limits.max_retries
            ):
                raise ConnectorFetchError(f"source request failed with HTTP {response.status_code}")
            await asyncio.sleep(self.config.rate_limits.backoff_seconds * (2**attempt))
        raise ConnectorFetchError("source request exhausted retries")

    async def records(
        self,
        resource: str,
        checkpoint: dict[str, Any] | None = None,
        since: str | None = None,
        path_params: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        endpoint = self.config.endpoints[resource]
        try:
            endpoint_path = endpoint.path.format(**(path_params or {}))
        except KeyError as exc:
            raise ConnectorFetchError(
                f"{resource} endpoint requires path parameter {exc.args[0]}"
            ) from exc
        state = checkpoint or {}
        page_value = state.get("page")
        page = int(page_value) if page_value is not None else 1
        cursor = state.get("cursor")
        next_url: str | None = None
        seen_pages: set[str] = set()
        pages_fetched = 0
        async with httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=30,
            transport=self.transport,
        ) as client:
            while True:
                pages_fetched += 1
                if pages_fetched > 10000:
                    raise ConnectorFetchError(f"{resource} exceeded the pagination safety limit")
                params: dict[str, Any] = dict(endpoint.params)
                pagination = endpoint.pagination or self.config.pagination
                if since and pagination.since_param_name:
                    params[pagination.since_param_name] = _format_since(
                        since, pagination.since_format
                    )
                if pagination.style == "cursor" and pagination.page_size_param:
                    params[pagination.page_size_param] = pagination.page_size
                if pagination.style == "cursor" and cursor and pagination.cursor_is_url:
                    next_url = str(cursor)
                elif pagination.style == "cursor" and cursor:
                    params[pagination.cursor_request_param] = cursor
                elif pagination.style == "offset":
                    params[pagination.page_param] = state.get("offset", 0)
                    if pagination.page_size_param:
                        params[pagination.page_size_param] = pagination.page_size
                elif pagination.style == "page":
                    params[pagination.page_param] = page
                    if pagination.page_size_param:
                        params[pagination.page_size_param] = pagination.page_size
                request_path = next_url or endpoint_path
                if next_url:
                    parsed = urlparse(next_url)
                    configured_host = urlparse(self.config.base_url).netloc
                    if parsed.netloc and parsed.netloc != configured_host:
                        raise ConnectorFetchError("pagination link changed source host")
                response = await self._request(
                    client,
                    endpoint.method,
                    request_path,
                    None if next_url else params,
                )
                payload = response.json()
                items = (
                    get_path(payload, endpoint.response_root_key)
                    if endpoint.response_root_key
                    else payload
                )
                if endpoint.response_root_key is None and isinstance(items, dict):
                    for key in (
                        "items",
                        "results",
                        "content",
                        "data",
                        "jobs",
                        "applications",
                        "statuses",
                    ):
                        if isinstance(items.get(key), list):
                            items = items[key]
                            break
                if isinstance(items, dict):
                    yield items
                    return
                if not isinstance(items, list):
                    raise ConnectorFetchError(f"{resource} response did not contain a list")
                page_marker = repr(
                    (items[0] if items else None, items[-1] if items else None, len(items))
                )
                if items and page_marker in seen_pages:
                    raise ConnectorFetchError(f"{resource} returned a repeated pagination page")
                seen_pages.add(page_marker)
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
                    offset_value = state.get("offset")
                    offset = int(offset_value) if offset_value is not None else 0
                    state["offset"] = offset + len(items)
                elif pagination.style == "cursor":
                    cursor = get_path(payload, pagination.cursor_response_path)
                    if not cursor:
                        return
                    next_url = str(cursor) if pagination.cursor_is_url else None
                elif pagination.style == "link_header":
                    link = response.links.get("next", {}).get("url")
                    if not link:
                        return
                    parsed = urlparse(link)
                    if parsed.netloc and parsed.netloc != urlparse(str(response.url)).netloc:
                        raise ConnectorFetchError("pagination link changed source host")
                    next_url = link
