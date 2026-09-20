from __future__ import annotations

from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.services.migration.mcp_client import (
    _fetch_ashby_bundle,
    _fetch_workable_bundle,
    assess_import_contract,
    build_mcp_auth,
)
from app.services.migration.mcp_oauth import (
    _migration_scope,
    begin_oauth,
    exchange_code,
)


def _oauth_transport(request: httpx.Request) -> httpx.Response:
    if request.url == httpx.URL("https://mcp.example.com/mcp"):
        return httpx.Response(
            401,
            headers={
                "WWW-Authenticate": (
                    'Bearer resource_metadata="https://mcp.example.com/'
                    '.well-known/oauth-protected-resource", scope="read jobs"'
                )
            },
        )
    if request.url == httpx.URL("https://mcp.example.com/.well-known/oauth-protected-resource"):
        return httpx.Response(
            200,
            json={
                "resource": "https://mcp.example.com/mcp",
                "authorization_servers": ["https://auth.example.com"],
                "scopes_supported": ["read", "jobs"],
            },
        )
    if request.url == httpx.URL("https://auth.example.com/.well-known/oauth-authorization-server"):
        return httpx.Response(
            200,
            json={
                "issuer": "https://auth.example.com",
                "authorization_endpoint": "https://auth.example.com/authorize",
                "token_endpoint": "https://auth.example.com/token",
                "registration_endpoint": "https://auth.example.com/register",
                "code_challenge_methods_supported": ["S256"],
            },
        )
    if request.url == httpx.URL("https://auth.example.com/register"):
        return httpx.Response(
            201,
            json={
                "client_id": "smartats-client",
                "redirect_uris": ["https://app.example.com/oauth/callback"],
                "token_endpoint_auth_method": "none",
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "scope": "read jobs",
            },
        )
    if request.url == httpx.URL("https://auth.example.com/token"):
        return httpx.Response(
            200,
            json={
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "token_type": "bearer",
                "expires_in": 3600,
            },
        )
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_mcp_oauth_uses_discovery_dcr_and_pkce() -> None:
    transport = httpx.MockTransport(_oauth_transport)
    callback = "https://app.example.com/oauth/callback"

    started = await begin_oauth("https://mcp.example.com/mcp", callback, transport=transport)

    parsed = urlparse(started.authorization_url)
    params = parse_qs(parsed.query)
    assert parsed.path == "/authorize"
    assert params["client_id"] == ["smartats-client"]
    assert params["scope"] == ["read jobs"]
    assert params["code_challenge_method"] == ["S256"]
    assert params["resource"] == ["https://mcp.example.com/mcp"]

    token = await exchange_code(
        code="authorization-code",
        code_verifier=started.code_verifier,
        callback_url=callback,
        metadata=started.metadata,
        client_info=started.client,
        transport=transport,
    )
    assert token.access_token == "access-token"
    assert token.refresh_token == "refresh-token"


def test_workable_oauth_requests_only_migration_scopes() -> None:
    discovered = (
        "r_candidates w_candidates r_jobs w_jobs r_offers r_requisitions "
        "r_account r_employees r_timeoff r_time_tracking r_reviews r_reports"
    )

    scope = _migration_scope("https://mcp.workable.com/mcp", discovered)

    assert scope == "r_account r_jobs r_candidates"


def test_mcp_import_contract_requires_jobs_and_candidates() -> None:
    tools = [
        {"name": "list_jobs", "inputSchema": {"type": "object", "properties": {}}},
        {
            "name": "list_candidates",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ]

    contract = assess_import_contract(tools)

    assert contract["ready"] is True
    assert contract["selected_tools"] == {
        "job": "list_jobs",
        "candidate": "list_candidates",
    }


def test_pinpoint_uses_custom_headers_instead_of_bearer_auth() -> None:
    bearer, headers = build_mcp_auth(
        "pinpoint",
        "secret-key",
        {"mcp_account_host": "company.pinpointhq.com"},
    )

    assert bearer is None
    assert headers == {
        "X-API-KEY": "secret-key",
        "X-Original-Host": "company.pinpointhq.com",
    }


def _tool(name: str, *properties: str) -> dict:
    return {
        "name": name,
        "inputSchema": {
            "type": "object",
            "properties": {property_name: {} for property_name in properties},
        },
    }


class _WorkableSession:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    async def call_tool(self, name: str, arguments: dict):
        self.calls.append((name, arguments))
        if name == "get_accounts":
            payload = {"accounts": [{"subdomain": "example"}]}
        elif name == "get_jobs":
            payload = (
                {"jobs": [{"id": "job-1", "shortcode": "ENG-1", "title": "Engineer"}]}
                if arguments.get("state") == "published"
                else {"jobs": []}
            )
        elif name == "get_job_stages":
            payload = {"stages": [{"id": "stage-1", "name": "Applied"}]}
        elif name == "get_candidates":
            payload = {
                "candidates": [{"id": "candidate-1", "firstname": "Ada", "stage": "applied"}]
            }
        elif name == "get_candidate":
            payload = {
                "candidate": {
                    "id": "candidate-1",
                    "lastname": "Lovelace",
                    "resume_url": "https://files.example/resume.pdf",
                    "resume_metadata": {"filename": "resume.pdf"},
                }
            }
        else:
            raise AssertionError(f"Unexpected tool {name}")
        return SimpleNamespace(structuredContent=payload)


@pytest.mark.asyncio
async def test_workable_mcp_fetches_hierarchical_import_bundle() -> None:
    tools = [
        _tool("get_accounts"),
        _tool("get_jobs", "account", "state", "limit"),
        _tool("get_job_stages", "account", "shortcode"),
        _tool("get_candidates", "account", "shortcode", "updated_after", "limit"),
        _tool("get_candidate", "account", "id"),
    ]
    session = _WorkableSession()

    contract = assess_import_contract(tools, provider="workable")
    bundle = await _fetch_workable_bundle(session, tools, "2026-09-01T00:00:00Z")

    assert contract["ready"] is True
    assert bundle["job"][0]["title"] == "Engineer"
    assert bundle["stage"][0]["job_id"] == "job-1"
    assert bundle["candidate"][0]["lastname"] == "Lovelace"
    assert bundle["candidate"][0]["job"]["shortcode"] == "ENG-1"
    assert bundle["resume"][0]["candidate_id"] == "candidate-1"
    assert (
        "get_candidates",
        {
            "account": "example",
            "shortcode": "ENG-1",
            "updated_after": "2026-09-01T00:00:00Z",
            "limit": 100,
        },
    ) in session.calls


def test_ashby_contract_requires_jobs_and_applications() -> None:
    contract = assess_import_contract(
        [
            _tool("list_jobs"),
            _tool("list_applications", "cursor", "limit"),
            _tool("get_application_details", "applicationId"),
            _tool("get_candidate_details", "candidateId"),
        ],
        provider="ashby",
    )

    assert contract["ready"] is True
    assert contract["selected_tools"] == {
        "job": "list_jobs",
        "application": "list_applications",
        "application_detail": "get_application_details",
        "candidate_detail": "get_candidate_details",
    }


def test_ashby_contract_rejects_candidate_search_without_application_collection() -> None:
    contract = assess_import_contract(
        [_tool("list_jobs"), _tool("search_candidates", "query")],
        provider="ashby",
    )

    assert contract["ready"] is False
    assert contract["missing_entities"] == [
        "application",
        "application_detail",
        "candidate_detail",
    ]


class _AshbySession:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    async def call_tool(self, name: str, arguments: dict):
        self.calls.append((name, arguments))
        if name == "list_jobs":
            payload = {"jobs": [{"id": "job-1", "title": "Platform Engineer"}]}
        elif name == "get_job_details":
            payload = {
                "job": {
                    "id": "job-1",
                    "title": "Platform Engineer",
                    "interviewPlan": {"stages": [{"id": "stage-1", "name": "Technical Interview"}]},
                }
            }
        elif name == "list_applications":
            payload = {
                "applications": [
                    {
                        "id": "application-1",
                        "candidateId": "candidate-1",
                        "jobId": "job-1",
                    }
                ]
            }
        elif name == "get_application_details":
            payload = {
                "application": {
                    "id": "application-1",
                    "candidate": {"id": "candidate-1"},
                    "job": {"id": "job-1", "title": "Platform Engineer"},
                    "currentInterviewStage": {
                        "id": "stage-1",
                        "name": "Technical Interview",
                    },
                    "status": "Active",
                }
            }
        elif name == "get_candidate_details":
            payload = {
                "candidate": {
                    "id": "candidate-1",
                    "name": "Ada Lovelace",
                    "emailAddresses": [{"value": "ada@example.com", "isPrimary": True}],
                    "files": [
                        {
                            "id": "resume-1",
                            "name": "Ada Resume.pdf",
                            "type": "Resume",
                            "downloadUrl": "https://files.example/ada-resume.pdf",
                            "contentType": "application/pdf",
                        }
                    ],
                }
            }
        else:
            raise AssertionError(f"Unexpected tool {name}")
        return SimpleNamespace(structuredContent=payload)


@pytest.mark.asyncio
async def test_ashby_mcp_builds_linked_canonical_bundle() -> None:
    tools = [
        _tool("list_jobs", "cursor", "limit"),
        _tool("get_job_details", "jobId"),
        _tool("list_applications", "cursor", "limit"),
        _tool("get_application_details", "applicationId"),
        _tool("get_candidate_details", "candidateId"),
    ]
    for tool in tools[1::2]:
        tool["inputSchema"]["required"] = list(tool["inputSchema"]["properties"])
    tools[-1]["inputSchema"]["required"] = ["candidateId"]

    bundle = await _fetch_ashby_bundle(_AshbySession(), tools, None)

    assert bundle["job"] == [
        {
            "external_job_id": "job-1",
            "title": "Platform Engineer",
            "description": None,
        }
    ]
    assert bundle["stage"][0]["external_stage_id"] == "stage-1"
    assert bundle["candidate"][0]["email"] == "ada@example.com"
    assert bundle["candidate"][0]["first_name"] == "Ada"
    assert bundle["application"][0] == {
        "external_application_id": "application-1",
        "external_candidate_id": "candidate-1",
        "external_job_id": "job-1",
        "external_stage_id": "stage-1",
        "status": "Active",
    }
    assert bundle["resume"][0]["source_url"] == "https://files.example/ada-resume.pdf"
