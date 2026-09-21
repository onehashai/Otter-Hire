from __future__ import annotations

import json
import re
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client

from app.services.migration.mcp_mapping import adapt_mcp_bundle
from app.services.migration.provider_adapter import adapt_provider_bundle

ENTITY_ALIASES = {
    "job": ("job", "requisition", "opening", "posting"),
    "stage": ("stage", "status", "pipeline"),
    "candidate": ("candidate", "applicant", "application", "opportunity", "profile"),
    "application": ("application",),
    "resume": ("resume", "attachment", "document"),
    "interview": ("interview",),
    "note": ("note", "comment"),
}
SAFE_OPTIONAL_ARGUMENTS = {
    "since",
    "updated_since",
    "updatedAt",
    "updated_after",
    "limit",
    "cursor",
    "offset",
    "page",
    "pageId",
    "page_id",
    "per_page",
    "page_size",
    "pageSize",
    "since_id",
}
WRITE_TOOL_PREFIXES = (
    "add_",
    "archive_",
    "change_",
    "create_",
    "delete_",
    "disqualify_",
    "move_",
    "remove_",
    "update_",
    "commit_",
    "cancel_",
    "send_",
    "set_",
    "execute_",
)
MCP_MAPPED_PROVIDERS = frozenset(
    {"ashby", "greenhouse", "workable", "ninehire", "pinpoint", "zoho_recruit"}
)
RECRUITMENT_ARGUMENTS = ("recruitmentId", "recruitment_id")
PROGRESS_ARGUMENTS = ("applicantProgressId", "applicant_progress_id", "progressId", "id")
ZOHO_MODULE_ARGUMENTS = ("module", "module_name", "module_api_name", "moduleName")
PINPOINT_COLLECTIONS = {
    "job": (
        "jobs",
        {"include": "stages", "filter[visibility]": "confidential,external,internal,private_job"},
    ),
    "candidate": ("candidates", {"extra_fields[candidates]": "attachments"}),
    "application": (
        "applications",
        {
            "include": "stage",
            "extra_fields[applications]": "attachments",
            "filter[job_visibility]": "confidential,external,internal,private_job",
        },
    ),
    "note": ("comments", {"include": "commentable"}),
    "interview": ("interviews", {"include": "interviewable"}),
}


def build_mcp_auth(
    provider: str,
    credential: str | None,
    provider_details: dict[str, Any] | None = None,
) -> tuple[str | None, dict[str, str]]:
    details = provider_details or {}
    if provider.lower() == "pinpoint":
        account_host = str(details.get("mcp_account_host") or "").strip()
        if not credential or not account_host:
            raise ValueError("Pinpoint MCP requires an API key and account host")
        return None, {"X-API-KEY": credential, "X-Original-Host": account_host}
    return credential, {}


def _result_payload(result: Any) -> Any:
    if getattr(result, "isError", False):
        # Provider errors can contain credentials or personal data; do not echo them.
        raise ValueError("MCP provider returned a tool error; verify access and required scopes")
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


def _tool_schema(tool: dict[str, Any]) -> dict[str, Any]:
    schema = tool.get("inputSchema") or tool.get("input_schema") or {}
    return schema if isinstance(schema, dict) else {}


def _tool_required_arguments(tool: dict[str, Any]) -> set[str]:
    required = _tool_schema(tool).get("required") or []
    return {str(item) for item in required}


def _tool_properties(tool: dict[str, Any]) -> set[str]:
    properties = _tool_schema(tool).get("properties") or {}
    return {str(item) for item in properties} if isinstance(properties, dict) else set()


def _is_read_tool(tool: dict[str, Any]) -> bool:
    annotations = tool.get("annotations") or {}
    if isinstance(annotations, dict) and annotations.get("readOnlyHint") is False:
        return False
    name = _normalized_tool_name(tool)
    if any(name.startswith(prefix) or f"_{prefix}" in name for prefix in WRITE_TOOL_PREFIXES):
        return False
    return bool(
        annotations.get("readOnlyHint") is True
        or re.search(r"(^|_)(list|get|search|fetch|overview)_", name)
    )


def _normalized_tool_name(tool: dict[str, Any]) -> str:
    return (
        re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(tool.get("name") or ""))
        .strip()
        .lower()
        .replace("-", "_")
        .replace(".", "_")
        .replace(" ", "_")
    )


def _find_read_tool(
    tools: list[dict[str, Any]],
    names: tuple[str, ...],
    *,
    allowed_required: set[str] | None = None,
) -> dict[str, Any] | None:
    allowed = allowed_required or set()
    normalized_names = tuple(name.lower() for name in names)
    candidates = []
    for tool in tools:
        if not _is_read_tool(tool):
            continue
        tool_name = _normalized_tool_name(tool)
        if not any(
            tool_name == name or tool_name.endswith(f"_{name}") for name in normalized_names
        ):
            continue
        if _tool_required_arguments(tool) - allowed:
            continue
        candidates.append(tool)
    candidates.sort(
        key=lambda tool: (
            0 if _normalized_tool_name(tool) in normalized_names else 1,
            len(_tool_required_arguments(tool)),
            _normalized_tool_name(tool),
        )
    )
    return candidates[0] if candidates else None


def _select_ashby_tools(tools: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    selected: dict[str, dict[str, Any]] = {}
    jobs = _find_read_tool(
        tools, ("list_jobs", "get_jobs"), allowed_required=SAFE_OPTIONAL_ARGUMENTS
    )
    applications = _find_read_tool(
        tools, ("list_applications", "get_applications"), allowed_required=SAFE_OPTIONAL_ARGUMENTS
    )
    if jobs:
        selected["job"] = jobs
    if applications:
        selected["application"] = applications

    application_detail = _find_read_tool(
        tools,
        ("get_application_details", "get_application", "application_details"),
        allowed_required={"applicationId", "application_id", "id"},
    )
    candidate_detail = _find_read_tool(
        tools,
        ("get_candidate_details", "get_candidate", "candidate_details"),
        allowed_required={"candidateId", "candidate_id", "id"},
    )
    if application_detail:
        selected["application_detail"] = application_detail
    if candidate_detail:
        selected["candidate_detail"] = candidate_detail

    candidates = _find_read_tool(
        tools, ("list_candidates", "get_candidates"), allowed_required=SAFE_OPTIONAL_ARGUMENTS
    )
    if candidates:
        selected["candidate"] = candidates
    return selected


def _select_tools(
    tools: list[dict[str, Any]], explicit_mapping: dict[str, str] | None
) -> dict[str, dict[str, Any]]:
    by_name = {str(tool.get("name")): tool for tool in tools if tool.get("name")}
    selected: dict[str, dict[str, Any]] = {}
    for entity, tool_name in (explicit_mapping or {}).items():
        tool = by_name.get(tool_name)
        if (
            entity in ENTITY_ALIASES
            and tool
            and _is_read_tool(tool)
            and not (_tool_required_arguments(tool) - SAFE_OPTIONAL_ARGUMENTS)
        ):
            selected[entity] = tool
    for entity in ENTITY_ALIASES:
        if entity in selected:
            continue
        # Match collections, never an arbitrary tool containing "job" or "profile".
        for alias in (f"{entity}s",):
            matches = [
                tool
                for tool in tools
                if any(
                    _normalized_tool_name(tool).endswith(name)
                    for name in (f"list_{alias}", f"get_{alias}", f"get_all_{alias}")
                )
                and _is_read_tool(tool)
                and not (_tool_required_arguments(tool) - SAFE_OPTIONAL_ARGUMENTS)
            ]
            if not matches:
                continue
            matches.sort(
                key=lambda tool: (
                    0
                    if any(
                        prefix in str(tool.get("name", "")).lower()
                        for prefix in ("list_", "get_all", "search_", "get_")
                    )
                    else 1,
                    len(_tool_required_arguments(tool)),
                    str(tool.get("name")),
                )
            )
            selected[entity] = matches[0]
            break
    return selected


def _select_provider_tools(provider: str, tools: list[dict]) -> dict[str, dict]:
    if provider == "ninehire":
        definitions = {
            "job": (("get_recruitments",), SAFE_OPTIONAL_ARGUMENTS),
            "job_detail": (("get_recruitment",), set(RECRUITMENT_ARGUMENTS)),
            "application": (
                ("get_applicant_progresses",),
                SAFE_OPTIONAL_ARGUMENTS | set(RECRUITMENT_ARGUMENTS),
            ),
            "application_detail": (
                ("get_applicant_progress",),
                set(RECRUITMENT_ARGUMENTS + PROGRESS_ARGUMENTS),
            ),
        }
    elif provider == "zoho_recruit":
        # Search-only servers requiring criteria cannot enumerate a complete migration.
        definitions = {
            "records": (("search_records",), SAFE_OPTIONAL_ARGUMENTS | set(ZOHO_MODULE_ARGUMENTS))
        }
    else:
        definitions = {
            entity: ((f"list_{plural}", f"get_{plural}"), SAFE_OPTIONAL_ARGUMENTS)
            for entity, plural in {
                "job": "jobs",
                "candidate": "candidates",
                "application": "applications",
                "stage": "job_interview_stages",
                "application_stage": "application_stages",
                "resume": "attachments",
                "note": "notes",
                "interview": "interviews",
            }.items()
        }
    selected = {}
    for entity, (names, required) in definitions.items():
        tool = _find_read_tool(tools, names, allowed_required=required)
        if tool:
            selected[entity] = tool
    if provider == "zoho_recruit" and "records" in selected:
        tool = selected["records"]
        module_arg = next(
            (name for name in ZOHO_MODULE_ARGUMENTS if name in _tool_properties(tool)), None
        )
        if module_arg is None:
            return {}
        enum = _tool_schema(tool)["properties"][module_arg].get("enum")
        if enum and not {"Job_Openings", "Candidates", "Applications"}.issubset(enum):
            return {}
        if "page" not in _tool_properties(tool):
            return {}
    if provider == "ninehire":
        for entity, aliases in (
            ("job_detail", RECRUITMENT_ARGUMENTS),
            ("application", RECRUITMENT_ARGUMENTS),
            ("application_detail", PROGRESS_ARGUMENTS),
        ):
            if entity in selected and not (_tool_properties(selected[entity]) & set(aliases)):
                selected.pop(entity)
    return selected


def _pinpoint_execute_tool(tools: list[dict]) -> dict | None:
    # This tool is deliberately NOT allowed through generic read-tool selection.
    # Only the fixed GET request builder below may call it.
    for tool in tools:
        if tool.get("name") != "execute-request":
            continue
        properties = _tool_schema(tool).get("properties") or {}
        har = properties.get("harRequest") or {}
        if {"method", "url"}.issubset(har.get("properties") or {}) and not (
            _tool_required_arguments(tool) - {"harRequest"}
        ):
            return tool
    return None


def _arguments_for_tool(
    tool: dict[str, Any],
    *,
    since: str | None = None,
    cursor: Any = None,
    fixed_arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    properties = _tool_properties(tool)
    arguments = {
        key: value
        for key, value in (fixed_arguments or {}).items()
        if key in properties and value is not None
    }
    if since:
        for name in ("since", "updated_since", "updatedAt", "updated_after"):
            if name in properties:
                arguments[name] = since
                break
    if cursor is not None:
        for name in ("cursor", "offset", "pageId", "page_id", "page", "since_id"):
            if name in properties:
                value = cursor
                if name == "since_id" and isinstance(cursor, str) and "://" in cursor:
                    value = (parse_qs(urlparse(cursor).query).get("since_id") or [cursor])[0]
                arguments[name] = value
                break
    if "limit" in properties:
        arguments["limit"] = 100
    for name in ("per_page", "page_size", "pageSize"):
        if name in properties:
            arguments[name] = 100
    for name in ("limit", "per_page", "page_size", "pageSize"):
        if name in arguments:
            maximum = (_tool_schema(tool).get("properties", {}).get(name) or {}).get("maximum")
            if isinstance(maximum, (int, float)):
                arguments[name] = min(arguments[name], int(maximum))
    if cursor is None and "page" in properties:
        arguments.setdefault("page", 1)
    if cursor is None and "offset" in _tool_required_arguments(tool):
        arguments.setdefault("offset", 0)
    for name in _tool_required_arguments(tool) - arguments.keys():
        schema = _tool_schema(tool).get("properties", {}).get(name) or {}
        if "default" in schema:
            arguments[name] = schema["default"]
    missing = _tool_required_arguments(tool) - arguments.keys()
    if missing:
        raise ValueError(
            f"MCP tool {tool['name']} requires unsupported arguments: {', '.join(sorted(missing))}"
        )
    for name, value in list(arguments.items()):
        schema = (_tool_schema(tool).get("properties") or {}).get(name) or {}
        if schema.get("type") == "integer" and isinstance(value, str):
            if not value.isdecimal():
                raise ValueError(f"MCP tool {tool['name']} expects an integer for {name}")
            arguments[name] = int(value)
        if schema.get("enum") and arguments[name] not in schema["enum"]:
            raise ValueError(f"MCP tool {tool['name']} does not support the requested {name}")
    return arguments


def _records_from_payload(payload: Any, entity: str) -> tuple[list[dict[str, Any]], Any]:
    cursor = None
    value = payload
    if isinstance(payload, dict):
        if (
            payload.get("error")
            or payload.get("errors")
            or payload.get("success") is False
            or payload.get("status") == "error"
        ):
            raise ValueError("MCP provider returned an error response, not import records")
        for cursor_key in ("next_cursor", "nextCursor", "nextPageId", "next"):
            candidate = payload.get(cursor_key)
            if candidate not in (None, "", False):
                cursor = candidate
                break
        paging = payload.get("paging")
        if cursor is None and isinstance(paging, dict):
            cursor = paging.get("next") or paging.get("next_cursor")
        info = payload.get("info")
        if isinstance(info, dict) and info.get("more_records") is True:
            page = info.get("page")
            if not isinstance(page, int):
                raise ValueError("MCP pagination is missing its current page number")
            cursor = page + 1
        if cursor is None and (payload.get("has_more") is True or payload.get("hasMore") is True):
            raise ValueError("MCP provider reports more records without a continuation cursor")
        for wrapper in ("data", "result"):
            if isinstance(payload.get(wrapper), dict):
                records, nested_cursor = _records_from_payload(payload[wrapper], entity)
                return records, cursor if cursor is not None else nested_cursor
        singular = payload.get(entity)
        if singular is None:
            for alias in {
                "job": ("recruitment",),
                "application": ("applicantProgress", "applicant_progress"),
            }.get(entity, ()):
                if isinstance(payload.get(alias), dict):
                    singular = payload[alias]
                    break
        if isinstance(singular, dict):
            return [singular], cursor
        keys = (
            f"{entity}s",
            "attachments" if entity == "resume" else "",
            "comments" if entity == "note" else "",
            "recruitments" if entity == "job" else "",
            "applicantProgresses" if entity == "application" else "",
            "applicant_progresses" if entity == "application" else "",
            "job_interview_stages" if entity == "stage" else "",
            "opportunities" if entity == "candidate" else "",
            "applications" if entity == "candidate" else "",
            "data",
            "items",
            "results",
            "result",
            "records",
            "content",
        )
        value = next(
            (payload[key] for key in keys if key and isinstance(payload.get(key), list)),
            None,
        )
        if value is None:
            if any(
                key in payload
                for key in (
                    "id",
                    "uuid",
                    "jobId",
                    "candidateId",
                    "applicationId",
                    "recruitmentId",
                    "applicantProgressId",
                )
            ):
                value = [payload]
            else:
                raise ValueError(f"MCP {entity} response has no recognized record collection")
    if not isinstance(value, list):
        raise ValueError(f"MCP {entity} response is not structured record data")
    if any(not isinstance(item, dict) for item in value):
        raise ValueError(f"MCP {entity} collection contains non-object records")
    return value, cursor


@asynccontextmanager
async def _session(
    endpoint_url: str,
    access_token: str | None = None,
    extra_headers: dict[str, str] | None = None,
):
    headers = dict(extra_headers or {})
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    if endpoint_url.rstrip("/").endswith("/sse"):
        async with sse_client(endpoint_url, headers=headers) as streams:
            async with ClientSession(*streams) as session:
                await session.initialize()
                yield session
    else:
        async with streamablehttp_client(endpoint_url, headers=headers) as streams:
            # The third streamable HTTP value is a session-id callback, not a
            # ClientSession timeout. Passing it positionally breaks every request
            # with current MCP SDK releases.
            async with ClientSession(streams[0], streams[1]) as session:
                await session.initialize()
                yield session


async def discover_tools(
    endpoint_url: str,
    access_token: str | None = None,
    *,
    extra_headers: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    async with _session(endpoint_url, access_token, extra_headers) as session:
        tools = []
        cursor = None
        seen = set()
        for _ in range(100):
            result = (
                await session.list_tools(cursor=cursor) if cursor else await session.list_tools()
            )
            tools.extend(tool.model_dump(mode="json") for tool in result.tools)
            cursor = result.nextCursor
            if not cursor:
                return tools
            if cursor in seen:
                raise ValueError("MCP tool discovery returned a repeated cursor")
            seen.add(cursor)
        raise ValueError("MCP tool discovery exceeded the pagination safety limit")


def assess_import_contract(
    tools: list[dict[str, Any]],
    tool_mapping: dict[str, str] | None = None,
    *,
    provider: str = "",
) -> dict[str, Any]:
    normalized_provider = provider.lower()
    if normalized_provider == "pinpoint":
        execute = _pinpoint_execute_tool(tools)
        return {
            "ready": execute is not None,
            "selected_tools": {entity: "execute-request" for entity in PINPOINT_COLLECTIONS}
            if execute
            else {},
            "missing_entities": [] if execute else ["execute-request with HAR method/url schema"],
        }
    if normalized_provider in {"ninehire", "zoho_recruit", "greenhouse"}:
        selected = _select_provider_tools(normalized_provider, tools)
        required = {
            "ninehire": ("job", "job_detail", "application", "application_detail"),
            "zoho_recruit": ("records",),
            "greenhouse": ("job", "candidate", "application", "stage"),
        }[normalized_provider]
        missing = [entity for entity in required if entity not in selected]
        return {
            "ready": not missing,
            "selected_tools": {entity: tool["name"] for entity, tool in selected.items()},
            "missing_entities": missing,
            "limitation": "Zoho searchRecords must support unfiltered, paginated Job_Openings, Candidates and Applications reads."
            if normalized_provider == "zoho_recruit"
            else None,
        }
    if normalized_provider == "ashby":
        selected = _select_ashby_tools(tools)
        required = ("job", "application", "application_detail", "candidate_detail")
        missing = [entity for entity in required if entity not in selected]
        return {
            "ready": not missing,
            "selected_tools": {entity: tool["name"] for entity, tool in selected.items()},
            "missing_entities": missing,
        }
    if normalized_provider == "workable":
        required_tools = {
            "account": "get_accounts",
            "job": "get_jobs",
            "stage": "get_job_stages",
            "candidate": "get_candidates",
        }
        available = {
            str(tool.get("name")): tool
            for tool in tools
            if tool.get("name") and _is_read_tool(tool)
        }
        selected_tools = {
            entity: name for entity, name in required_tools.items() if name in available
        }
        missing = [entity for entity in required_tools if entity not in selected_tools]
        return {
            "ready": not missing,
            "selected_tools": selected_tools,
            "missing_entities": missing,
        }
    selected = _select_tools(tools, tool_mapping)
    required_entities = {"job", "candidate"}
    missing = sorted(required_entities - selected.keys())
    return {
        "ready": not missing,
        "selected_tools": {entity: tool["name"] for entity, tool in selected.items()},
        "missing_entities": missing,
    }


async def fetch_candidates_from_mcp(
    endpoint_url: str,
    access_token: str,
    cached_tools: dict[str, Any] | list[dict[str, Any]],
    since: str | None = None,
) -> list[dict[str, Any]]:
    tools = cached_tools.get("tools", []) if isinstance(cached_tools, dict) else cached_tools
    selected = _select_tools(tools, None)
    candidate_tool = selected.get("candidate")
    if not candidate_tool:
        raise ValueError("Connected MCP server does not publish a candidate collection tool")
    async with _session(endpoint_url, access_token) as session:
        return await _fetch_tool_pages(session, candidate_tool, "candidate", since)


def _tool_by_name(tools: list[dict[str, Any]], name: str) -> dict[str, Any]:
    tool = next(
        (tool for tool in tools if tool.get("name") == name and _is_read_tool(tool)),
        None,
    )
    if tool is None:
        raise ValueError(f"Workable MCP server does not publish required tool {name}")
    return tool


def _named_argument(
    tool: dict[str, Any], aliases: tuple[str, ...], value: Any, label: str
) -> dict[str, Any]:
    properties = _tool_properties(tool)
    name = next((candidate for candidate in aliases if candidate in properties), None)
    if name is None:
        raise ValueError(f"MCP tool {tool['name']} has no {label} argument")
    return {name: value}


async def _fetch_workable_bundle(
    session: ClientSession,
    tools: list[dict[str, Any]],
    since: str | None,
) -> dict[str, list[dict[str, Any]]]:
    account_tool = _tool_by_name(tools, "get_accounts")
    account_payload = _result_payload(await session.call_tool(account_tool["name"], {}))
    accounts, _ = _records_from_payload(account_payload, "account")
    if not accounts:
        raise ValueError("Workable OAuth user has no accessible accounts")
    if len(accounts) > 1:
        raise ValueError(
            "Workable OAuth user has multiple accounts; account selection is required before sync"
        )
    account = accounts[0].get("subdomain") or accounts[0].get("account")
    if not account:
        raise ValueError("Workable get_accounts response has no account subdomain")

    jobs_tool = _tool_by_name(tools, "get_jobs")
    account_arguments = _named_argument(jobs_tool, ("account", "subdomain"), account, "account")
    states = (
        ("published", "draft", "archived", "closed")
        if "state" in _tool_properties(jobs_tool)
        else (None,)
    )
    jobs_by_id: dict[str, dict[str, Any]] = {}
    for state in states:
        arguments = {**account_arguments, **({"state": state} if state else {})}
        for job in await _fetch_tool_pages(
            session, jobs_tool, "job", since, fixed_arguments=arguments
        ):
            identity = job.get("id") or job.get("shortcode")
            if identity is not None:
                jobs_by_id[str(identity)] = job
            else:
                raise ValueError("Workable job response has no stable ID")
    jobs = list(jobs_by_id.values())

    stages_tool = _tool_by_name(tools, "get_job_stages")
    candidates_tool = _tool_by_name(tools, "get_candidates")
    detail_tool = next(
        (tool for tool in tools if tool.get("name") == "get_candidate" and _is_read_tool(tool)),
        None,
    )
    activity_tool = next(
        (
            tool
            for tool in tools
            if tool.get("name") == "get_candidate_activities" and _is_read_tool(tool)
        ),
        None,
    )
    stages: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    resumes: list[dict[str, Any]] = []
    messages: list[dict[str, Any]] = []
    warnings: list[str] = []
    for job in jobs:
        shortcode = job.get("shortcode") or job.get("code")
        if not shortcode:
            raise ValueError("Workable job response has no shortcode for reading its candidates")
        job_id = job.get("id") or shortcode
        job_context = {"shortcode": shortcode, "title": job.get("title")}

        stage_arguments = {
            **_named_argument(stages_tool, ("account", "subdomain"), account, "account"),
            **_named_argument(
                stages_tool,
                ("shortcode", "job_shortcode", "job", "job_id"),
                shortcode,
                "job shortcode",
            ),
        }
        job_stages = await _fetch_tool_pages(
            session, stages_tool, "stage", None, fixed_arguments=stage_arguments
        )
        for position, stage in enumerate(job_stages):
            stages.append({**stage, "job_id": job_id, "position": stage.get("position", position)})

        candidate_arguments = {
            **_named_argument(candidates_tool, ("account", "subdomain"), account, "account"),
            **_named_argument(
                candidates_tool,
                ("shortcode", "job_shortcode", "job", "job_id"),
                shortcode,
                "job shortcode",
            ),
        }
        summaries = await _fetch_tool_pages(
            session,
            candidates_tool,
            "candidate",
            since,
            fixed_arguments=candidate_arguments,
        )
        for summary in summaries:
            candidate = dict(summary)
            candidate_id = candidate.get("id") or candidate.get("candidate_id")
            if detail_tool and candidate_id is not None:
                detail_arguments = {
                    **_named_argument(detail_tool, ("account", "subdomain"), account, "account"),
                    **_named_argument(
                        detail_tool,
                        ("candidate_id", "id"),
                        candidate_id,
                        "candidate ID",
                    ),
                }
                if "shortcode" in _tool_properties(detail_tool):
                    detail_arguments["shortcode"] = shortcode
                detail_payload = _result_payload(
                    await session.call_tool(detail_tool["name"], detail_arguments)
                )
                detailed, _ = _records_from_payload(detail_payload, "candidate")
                if detailed:
                    candidate = {**candidate, **detailed[0]}
            candidate.setdefault("job", job_context)
            candidates.append(candidate)
            if activity_tool and candidate_id is not None:
                try:
                    activity_arguments = {
                        **_named_argument(
                            activity_tool, ("account", "subdomain"), account, "account"
                        ),
                        **_named_argument(
                            activity_tool,
                            ("candidate_id", "id"),
                            candidate_id,
                            "candidate ID",
                        ),
                    }
                    if "shortcode" in _tool_properties(activity_tool):
                        activity_arguments["shortcode"] = shortcode
                    for activity_record in await _fetch_tool_pages(
                        session,
                        activity_tool,
                        "message",
                        None,
                        fixed_arguments=activity_arguments,
                    ):
                        messages.append({**activity_record, "candidate_id": candidate_id})
                except Exception as exc:
                    warning = (
                        "Message history was not imported from Workable MCP for "
                        f"candidate {candidate_id}: {str(exc)[:300]}"
                    )
                    if warning not in warnings:
                        warnings.append(warning)
            resume_url = candidate.get("resume_url")
            if resume_url:
                metadata = candidate.get("resume_metadata")
                metadata = metadata if isinstance(metadata, dict) else {}
                resumes.append(
                    {
                        "id": metadata.get("id") or f"{candidate_id}:resume",
                        "candidate_id": candidate_id,
                        "resume_url": resume_url,
                        "resume_metadata": metadata,
                    }
                )

    bundle = {"job": jobs, "stage": stages, "candidate": candidates}
    if resumes:
        bundle["resume"] = resumes
    if messages:
        bundle["message"] = messages
    if warnings:
        bundle["__warnings"] = warnings
    return adapt_provider_bundle("workable", bundle)


async def _fetch_detail_record(
    session: ClientSession,
    tool: dict[str, Any] | None,
    entity: str,
    identifier: Any,
    aliases: tuple[str, ...],
) -> dict[str, Any] | None:
    if tool is None or identifier in (None, ""):
        return None
    arguments = _arguments_for_tool(
        tool, fixed_arguments=_named_argument(tool, aliases, identifier, f"{entity} ID")
    )
    payload = _result_payload(await session.call_tool(tool["name"], arguments))
    records, _ = _records_from_payload(payload, entity)
    return records[0] if records else None


def _record_identifier(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = record.get(key)
        if isinstance(value, dict):
            value = value.get("id") or value.get("uuid") or value.get("value")
        if value not in (None, ""):
            return value
    return None


async def _fetch_ashby_bundle(
    session: ClientSession,
    tools: list[dict[str, Any]],
    since: str | None,
) -> dict[str, list[dict[str, Any]]]:
    selected = _select_ashby_tools(tools)
    required = ("job", "application", "application_detail", "candidate_detail")
    missing = [entity for entity in required if entity not in selected]
    if missing:
        raise ValueError(f"Ashby MCP server is missing collection tools: {', '.join(missing)}")

    jobs = await _fetch_tool_pages(session, selected["job"], "job", since)
    applications = await _fetch_tool_pages(session, selected["application"], "application", since)
    candidates = (
        await _fetch_tool_pages(session, selected["candidate"], "candidate", since)
        if selected.get("candidate")
        else []
    )

    job_detail_tool = _find_read_tool(
        tools,
        ("get_job_details", "get_job", "job_details"),
        allowed_required={"jobId", "job_id", "id"},
    )
    application_detail_tool = selected["application_detail"]
    candidate_detail_tool = selected["candidate_detail"]

    hydrated_jobs: list[dict[str, Any]] = []
    for summary in jobs:
        job_id = _record_identifier(summary, "id", "jobId", "job_id")
        detail = await _fetch_detail_record(
            session,
            job_detail_tool,
            "job",
            job_id,
            ("jobId", "job_id", "id"),
        )
        hydrated_jobs.append({**summary, **(detail or {})})

    hydrated_applications: list[dict[str, Any]] = []
    candidate_ids: set[str] = set()
    for summary in applications:
        application_id = _record_identifier(summary, "id", "applicationId", "application_id")
        detail = await _fetch_detail_record(
            session,
            application_detail_tool,
            "application",
            application_id,
            ("applicationId", "application_id", "id"),
        )
        application = {**summary, **(detail or {})}
        hydrated_applications.append(application)
        candidate_id = _record_identifier(application, "candidate", "candidateId", "candidate_id")
        if candidate_id is not None:
            candidate_ids.add(str(candidate_id))

    candidates_by_id = {
        str(candidate_id): candidate
        for candidate in candidates
        if (candidate_id := _record_identifier(candidate, "id", "candidateId", "candidate_id"))
        is not None
    }
    for candidate_id in sorted(candidate_ids):
        existing = candidates_by_id.get(candidate_id, {})
        detail = await _fetch_detail_record(
            session,
            candidate_detail_tool,
            "candidate",
            candidate_id,
            ("candidateId", "candidate_id", "id"),
        )
        candidates_by_id[candidate_id] = {**existing, **(detail or {}), "id": candidate_id}

    return adapt_provider_bundle(
        "ashby",
        {
            "job": hydrated_jobs,
            "candidate": list(candidates_by_id.values()),
            "application": hydrated_applications,
        },
    )


async def _fetch_tool_pages(
    session: ClientSession,
    tool: dict[str, Any],
    entity: str,
    since: str | None,
    fixed_arguments: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    cursor: Any = None
    seen_cursors: set[str] = set()
    for _ in range(1000):
        payload = _result_payload(
            await session.call_tool(
                tool["name"],
                _arguments_for_tool(
                    tool,
                    since=since,
                    cursor=cursor,
                    fixed_arguments=fixed_arguments,
                ),
            )
        )
        page, next_cursor = _records_from_payload(payload, entity)
        records.extend(page)
        if next_cursor is None:
            break
        if not (
            _tool_properties(tool) & {"cursor", "offset", "pageId", "page_id", "page", "since_id"}
        ):
            raise ValueError(
                f"MCP tool {tool['name']} returned more records but accepts no pagination argument"
            )
        marker = str(next_cursor)
        if marker in seen_cursors:
            raise ValueError(f"MCP tool {tool['name']} returned a repeated pagination cursor")
        seen_cursors.add(marker)
        cursor = next_cursor
    else:
        raise ValueError(f"MCP tool {tool['name']} exceeded the pagination safety limit")
    return records


def _pinpoint_payload(payload: Any) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Pinpoint MCP response is not structured JSON")
    status = payload.get("status") or payload.get("statusCode")
    if status is not None and str(status).isdigit() and int(status) >= 400:
        raise ValueError(f"Pinpoint read failed with HTTP {status}; check API permissions")
    body = payload.get("body", payload)
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError as exc:
            raise ValueError("Pinpoint returned a non-JSON response") from exc
    if not isinstance(body, dict) or body.get("errors") or not isinstance(body.get("data"), list):
        raise ValueError("Pinpoint returned an error or an unsupported collection response")
    return body


async def _fetch_pinpoint_bundle(
    session: ClientSession, tools: list[dict], headers: dict[str, str]
) -> dict:
    tool = _pinpoint_execute_tool(tools)
    if not tool:
        raise ValueError("Pinpoint execute-request schema is unavailable")
    host = headers.get("X-Original-Host", "").lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.pinpointhq\.com", host):
        raise ValueError("Pinpoint requires a valid company.pinpointhq.com account host")
    if not headers.get("X-API-KEY"):
        raise ValueError("Pinpoint requires an API key")
    bundle: dict[str, list[dict]] = {"stage": []}
    for entity, (collection, params) in PINPOINT_COLLECTIONS.items():
        bundle[entity] = []
        path = f"/api/v1/{collection}"
        url = f"https://{host}{path}?{urlencode({'page[size]': 100, 'page[number]': 1, 'sort': 'id', **params})}"
        seen = set()
        seen_records = set()
        for _ in range(1000):
            parsed = urlparse(url)
            if (
                parsed.scheme != "https"
                or parsed.netloc != host
                or parsed.path != path
                or parsed.fragment
            ):
                raise ValueError(
                    "Pinpoint pagination attempted to leave its allowed collection URL"
                )
            if url in seen:
                raise ValueError("Pinpoint returned a repeated pagination URL")
            seen.add(url)
            payload = _pinpoint_payload(
                _result_payload(
                    await session.call_tool(
                        tool["name"],
                        {
                            "harRequest": {
                                "method": "GET",
                                "url": url,
                                "headers": [
                                    {"name": "Accept", "value": "application/vnd.api+json"}
                                ],
                            },
                        },
                    )
                )
            )
            if any(not isinstance(row, dict) for row in payload["data"]):
                raise ValueError("Pinpoint collection contains invalid records")
            identities = {(row.get("type"), str(row.get("id"))) for row in payload["data"]}
            if identities and identities.issubset(seen_records):
                raise ValueError("Pinpoint returned a repeated page of records")
            seen_records.update(identities)
            bundle[entity].extend(payload["data"])
            bundle["stage"].extend(
                row
                for row in payload.get("included", [])
                if isinstance(row, dict) and row.get("type") == "stages"
            )
            next_url = (payload.get("links") or {}).get("next")
            if isinstance(next_url, dict):
                next_url = next_url.get("href")
            if not next_url:
                # Pinpoint supports page[number]; some responses omit links entirely.
                if "next" in (payload.get("links") or {}) or len(payload["data"]) < 100:
                    break
                query = parse_qs(parsed.query)
                page = int((query.get("page[number]") or ["1"])[0]) + 1
                query["page[number]"] = [str(page)]
                url = parsed._replace(query=urlencode(query, doseq=True)).geturl()
                continue
            if not isinstance(next_url, str):
                raise ValueError("Pinpoint returned an invalid pagination URL")
            url = urljoin(url, next_url)
        else:
            raise ValueError("Pinpoint exceeded the pagination safety limit")
    return adapt_mcp_bundle("pinpoint", bundle)


async def _fetch_ninehire_bundle(session: ClientSession, selected: dict[str, dict]) -> dict:
    jobs = await _fetch_tool_pages(session, selected["job"], "job", None)
    hydrated_jobs = []
    applications = []
    for summary in jobs:
        job_id = _record_identifier(summary, "id", "recruitmentId")
        if job_id is None:
            raise ValueError("Ninehire recruitment response is missing its ID")
        detail = await _fetch_detail_record(
            session, selected["job_detail"], "job", job_id, RECRUITMENT_ARGUMENTS
        )
        hydrated_jobs.append({**summary, **(detail or {}), "id": job_id})
        arguments = _named_argument(
            selected["application"], RECRUITMENT_ARGUMENTS, job_id, "recruitment ID"
        )
        for progress in await _fetch_tool_pages(
            session, selected["application"], "application", None, arguments
        ):
            progress_id = _record_identifier(progress, "id", "applicantProgressId")
            if progress_id is None:
                raise ValueError("Ninehire applicant progress is missing its ID")
            tool = selected["application_detail"]
            args = _named_argument(tool, PROGRESS_ARGUMENTS, progress_id, "applicant progress ID")
            for key in RECRUITMENT_ARGUMENTS:
                if key in _tool_properties(tool):
                    args[key] = job_id
                    break
            payload = _result_payload(
                await session.call_tool(
                    tool["name"], _arguments_for_tool(tool, fixed_arguments=args)
                )
            )
            records, _ = _records_from_payload(payload, "application")
            if len(records) != 1:
                raise ValueError("Ninehire applicant detail did not return one record")
            applications.append(
                {**progress, **records[0], "id": progress_id, "recruitmentId": job_id}
            )
    return adapt_mcp_bundle("ninehire", {"job": hydrated_jobs, "application": applications})


async def _fetch_zoho_bundle(session: ClientSession, selected: dict[str, dict]) -> dict:
    tool = selected["records"]
    bundle = {}
    for entity, module in (
        ("job", "Job_Openings"),
        ("candidate", "Candidates"),
        ("application", "Applications"),
    ):
        args = _named_argument(tool, ZOHO_MODULE_ARGUMENTS, module, "module")
        bundle[entity] = await _fetch_tool_pages(session, tool, entity, None, args)
    return adapt_mcp_bundle("zoho_recruit", bundle)


async def _hydrate_bamboohr_applications(
    session: ClientSession,
    tools: list[dict[str, Any]],
    bundle: dict[str, list[dict[str, Any]]],
) -> None:
    detail_tool = next(
        (tool for tool in tools if str(tool.get("name", "")).lower() == "get_application_details"),
        None,
    )
    if not detail_tool:
        return
    required = _tool_required_arguments(detail_tool)
    id_argument = next(
        (
            name
            for name in (
                "applicationId",
                "application_id",
                "id",
            )
            if name in required or name in _tool_properties(detail_tool)
        ),
        None,
    )
    if not id_argument:
        return
    summaries = bundle.get("candidate") or bundle.get("application") or []
    details: list[dict[str, Any]] = []
    for summary in summaries:
        application_id = summary.get("id") or summary.get("applicationId")
        if application_id is None:
            continue
        payload = _result_payload(
            await session.call_tool(detail_tool["name"], {id_argument: application_id})
        )
        records, _ = _records_from_payload(payload, "application")
        details.extend(records)
    if details:
        bundle["candidate"] = details
        bundle["application"] = details


async def fetch_entity_bundle_from_mcp(
    endpoint_url: str,
    access_token: str | None,
    cached_tools: dict[str, Any],
    since: str | None = None,
    *,
    provider: str = "",
    tool_mapping: dict[str, str] | None = None,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    tools = cached_tools.get("tools", [])
    provider = provider.lower()
    if provider in MCP_MAPPED_PROVIDERS:
        contract = assess_import_contract(tools, tool_mapping, provider=provider)
        if not contract["ready"]:
            raise ValueError(
                f"{provider} cannot migrate with its available tools: {', '.join(contract['missing_entities'])}"
            )
    if provider in {"pinpoint", "ninehire", "zoho_recruit"}:
        async with _session(endpoint_url, access_token, extra_headers) as session:
            if provider == "pinpoint":
                return await _fetch_pinpoint_bundle(session, tools, extra_headers or {})
            selected = _select_provider_tools(provider, tools)
            if provider == "ninehire":
                return await _fetch_ninehire_bundle(session, selected)
            return await _fetch_zoho_bundle(session, selected)
    if provider.lower() == "workable":
        async with _session(endpoint_url, access_token, extra_headers) as session:
            return await _fetch_workable_bundle(session, tools, since)
    if provider.lower() == "ashby":
        async with _session(endpoint_url, access_token, extra_headers) as session:
            return await _fetch_ashby_bundle(session, tools, since)
    selected = (
        _select_provider_tools(provider, tools)
        if provider == "greenhouse"
        else _select_tools(tools, tool_mapping)
    )
    if not selected:
        raise ValueError("Connected MCP server has no compatible read/list tools")
    bundle: dict[str, list[dict[str, Any]]] = {}
    async with _session(endpoint_url, access_token, extra_headers) as session:
        for entity, tool in selected.items():
            bundle[entity] = await _fetch_tool_pages(session, tool, entity, since)
            if provider == "greenhouse" and entity == "resume":
                bundle[entity] = [
                    record for record in bundle[entity] if record.get("type") == "resume"
                ]
        if provider.lower() == "bamboohr":
            await _hydrate_bamboohr_applications(session, tools, bundle)
    return adapt_provider_bundle(provider.lower(), bundle)
