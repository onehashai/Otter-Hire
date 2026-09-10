from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client


def _result_payload(result: Any) -> Any:
    structured = getattr(result, "structuredContent", None)
    if structured is not None:
        return structured
    records: list[Any] = []
    for content in getattr(result, "content", []) or []:
        text = getattr(content, "text", None)
        if not text:
            continue
        try:
            records.append(json.loads(text))
        except json.JSONDecodeError:
            records.append(text)
    return records[0] if len(records) == 1 else records


@asynccontextmanager
async def _session(endpoint_url: str, access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    if endpoint_url.rstrip("/").endswith("/sse"):
        async with sse_client(endpoint_url, headers=headers) as streams:
            async with ClientSession(*streams) as session:
                await session.initialize()
                yield session
    else:
        async with streamablehttp_client(endpoint_url, headers=headers) as streams:
            async with ClientSession(streams[0], streams[1], streams[2]) as session:
                await session.initialize()
                yield session


async def discover_tools(endpoint_url: str, access_token: str) -> list[dict[str, Any]]:
    async with _session(endpoint_url, access_token) as session:
        result = await session.list_tools()
        return [tool.model_dump(mode="json") for tool in result.tools]


async def fetch_candidates_from_mcp(
    endpoint_url: str,
    access_token: str,
    cached_tools: dict[str, Any] | list[dict[str, Any]],
    since: str | None = None,
) -> list[dict[str, Any]]:
    tools = cached_tools.get("tools", []) if isinstance(cached_tools, dict) else cached_tools
    candidates = [tool for tool in tools if "candidate" in str(tool.get("name", "")).lower()]
    if not candidates:
        raise ValueError("Connected MCP server does not publish a candidate tool")
    tool_name = candidates[0]["name"]
    arguments: dict[str, Any] = {}
    if since:
        arguments["since"] = since
        arguments["updated_since"] = since
    async with _session(endpoint_url, access_token) as session:
        result = await session.call_tool(tool_name, arguments)
    payload = _result_payload(result)
    if isinstance(payload, dict):
        for key in ("candidates", "data", "results", "items", "records"):
            if isinstance(payload.get(key), list):
                return payload[key]
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    raise ValueError("MCP candidate tool returned an unsupported response")


async def fetch_entity_bundle_from_mcp(endpoint_url: str, access_token: str, cached_tools: dict[str, Any], since: str | None = None) -> dict[str, list[dict[str, Any]]]:
    tools = cached_tools.get("tools", [])
    aliases = {
        "job": ("job", "requisition", "opening"),
        "stage": ("stage", "pipeline"),
        "candidate": ("candidate", "applicant", "profile"),
        "application": ("application",),
        "resume": ("resume", "attachment", "document"),
        "interview": ("interview",),
        "note": ("note", "comment"),
    }
    selected: dict[str, dict[str, Any]] = {}
    for entity, words in aliases.items():
        for tool in tools:
            name = str(tool.get("name", "")).lower()
            if any(word in name for word in words):
                selected[entity] = tool
                break
    bundle: dict[str, list[dict[str, Any]]] = {}
    async with _session(endpoint_url, access_token) as session:
        for entity, tool in selected.items():
            args = {"since": since} if since else {}
            result = _result_payload(await session.call_tool(tool["name"], args))
            if isinstance(result, dict):
                result = next((result[key] for key in (entity + "s", "data", "items", "records") if isinstance(result.get(key), list)), [result])
            bundle[entity] = [item for item in result if isinstance(item, dict)] if isinstance(result, list) else []
    return bundle
