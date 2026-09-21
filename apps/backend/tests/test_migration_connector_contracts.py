from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from app.api.v1.internal.endpoints.ats_migrations import router as migration_router
from app.schemas.canonical import CanonicalCandidate
from app.schemas.migration import GenericAtsConfigCreate
from app.services.migration.batch_service import _normalize_application_status
from app.services.migration.bridge import BRIDGE_PROVIDERS, bridge_tools_for
from app.services.migration.config_loader import (
    ConnectorAuth,
    ConnectorConfig,
    ConnectorEndpoint,
    PaginationConfig,
    get_path,
    load_connector_registry,
)
from app.services.migration.fetcher import GenericFetcher
from app.services.migration.mcp_client import _select_tools
from app.services.migration.message_content import sanitize_imported_message_content
from app.services.migration.provider_adapter import adapt_provider_bundle
from app.services.migration.provider_auth import (
    ProviderConnectionError,
    issue_greenhouse_access_token,
    validate_provider_base_url,
    validate_provider_connection,
)

CONFIG_DIR = Path(__file__).resolve().parents[1] / "app" / "migration_configs"


def _mapped(raw: dict, mapping: dict[str, str]) -> dict:
    return {field: get_path(raw, path) for field, path in mapping.items()}


def test_batch_history_exposes_a_delete_action() -> None:
    route = next(
        route
        for route in migration_router.routes
        if route.path == "/ats-migrations/batches/{batch_id}" and "DELETE" in route.methods
    )

    assert route.status_code == 204


def test_smartats_bridge_route_and_provider_contracts_are_available() -> None:
    route = next(
        route
        for route in migration_router.routes
        if route.path == "/ats-migrations/bridge/integrations" and "POST" in route.methods
    )
    registry = load_connector_registry(CONFIG_DIR)

    assert route.status_code == 201
    assert BRIDGE_PROVIDERS == {
        "bamboohr",
        "greenhouse",
        "lever",
        "smartrecruiters",
        "workable",
    }
    assert bridge_tools_for(registry["greenhouse"]) == [
        "list_jobs",
        "list_stages",
        "list_candidates",
        "list_applications",
        "list_resumes",
        "list_interviews",
        "list_notes",
        "list_messages",
    ]
    assert bridge_tools_for(registry["workable"]) == [
        "list_jobs",
        "list_stages",
        "list_candidates",
        "list_resumes",
        "list_messages",
    ]


def test_named_connector_contracts_use_current_provider_routes() -> None:
    registry = load_connector_registry(CONFIG_DIR)

    greenhouse = registry["greenhouse"]
    assert greenhouse.auth.type == "oauth2"
    assert greenhouse.endpoints["jobs"].path == "/v3/jobs"
    assert greenhouse.endpoints["resumes"].path == "/v3/attachments"
    assert greenhouse.endpoints["application_stages"].path == "/v3/application_stages"
    assert greenhouse.pagination.style == "link_header"

    lever = registry["lever"]
    assert lever.auth.type == "basic"
    assert lever.endpoints["jobs"].path == "/v1/postings"
    assert lever.endpoints["candidates"].path == "/v1/opportunities"
    assert lever.pagination.cursor_request_param == "offset"

    smartrecruiters = registry["smartrecruiters"]
    assert smartrecruiters.endpoints["jobs"].path == "/jobs"
    assert smartrecruiters.endpoints["candidates"].path == "/candidates"
    assert smartrecruiters.pagination.cursor_request_param == "pageId"

    bamboohr = registry["bamboohr"]
    assert bamboohr.endpoints["jobs"].path == "/api/v1/applicant_tracking/jobs"
    assert (
        bamboohr.endpoints["application_details"].path
        == "/api/v1/applicant_tracking/applications/{external_application_id}"
    )
    assert bamboohr.endpoints["candidates"].pagination.since_param_name == "newSince"

    workable = registry["workable"]
    assert workable.endpoints["candidates"].pagination.cursor_is_url is True
    assert workable.endpoints["candidates"].pagination.page_size_param == "limit"
    assert workable.mappings["job"] == {
        "external_job_id": "id",
        "title": "title",
        "description": "description",
        "shortcode": "shortcode",
        "category": "department",
        "city": "location.city",
        "country": "location.country_code",
        "workplace_type": "location.workplace_type",
    }
    assert lever.mappings["job"]["category"] == "categories.department|categories.team"
    assert smartrecruiters.mappings["job"]["category"] == "department.label"
    assert bamboohr.mappings["job"]["category"] == "department"
    assert greenhouse.mappings["job"]["category"] == "departments.0.name"


def test_mapping_path_uses_the_first_populated_alternative() -> None:
    job = {"categories": {"department": "", "team": "Engineering"}}

    assert get_path(job, "categories.department|categories.team") == "Engineering"


@pytest.mark.anyio
async def test_fetcher_follows_greenhouse_link_header_without_reusing_first_page_params() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.params.get("cursor") == "next-token":
            return httpx.Response(200, json=[{"id": 2}], request=request)
        return httpx.Response(
            200,
            json=[{"id": 1}],
            headers={"Link": '<https://example.test/v3/jobs?cursor=next-token>; rel="next"'},
            request=request,
        )

    config = ConnectorConfig(
        id="greenhouse",
        name="Greenhouse",
        base_url="https://example.test",
        auth=ConnectorAuth(type="oauth2"),
        endpoints={
            "jobs": ConnectorEndpoint(
                path="/v3/jobs",
                params={"per_page": 500},
            )
        },
        pagination=PaginationConfig(style="link_header"),
    )
    records = [
        record
        async for record in GenericFetcher(
            config,
            "token",
            transport=httpx.MockTransport(handler),
        ).records("jobs")
    ]

    assert records == [{"id": 1}, {"id": 2}]
    assert requests[0].url.params["per_page"] == "500"
    assert requests[1].url.params["cursor"] == "next-token"
    assert "per_page" not in requests[1].url.params


@pytest.mark.anyio
async def test_fetcher_treats_null_page_checkpoint_as_initial_page() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.params.get("page") == "1":
            return httpx.Response(200, json=[{"id": 1}], request=request)
        return httpx.Response(200, json=[], request=request)

    config = ConnectorConfig(
        id="page-connector",
        name="Page connector",
        base_url="https://example.test",
        endpoints={"jobs": ConnectorEndpoint(path="/jobs")},
        pagination=PaginationConfig(style="page", page_param="page", page_size_param=None),
    )
    records = [
        record
        async for record in GenericFetcher(
            config,
            transport=httpx.MockTransport(handler),
        ).records("jobs", checkpoint={"page": None})
    ]

    assert records == [{"id": 1}]
    assert requests[0].url.params["page"] == "1"


@pytest.mark.anyio
async def test_fetcher_uses_lever_opaque_next_token() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.params.get("offset") == "opaque.next.token":
            return httpx.Response(
                200,
                json={"data": [{"id": "two"}], "hasNext": False},
                request=request,
            )
        return httpx.Response(
            200,
            json={"data": [{"id": "one"}], "next": "opaque.next.token", "hasNext": True},
            request=request,
        )

    config = ConnectorConfig(
        id="lever",
        name="Lever",
        base_url="https://example.test",
        auth=ConnectorAuth(type="basic"),
        endpoints={
            "candidates": ConnectorEndpoint(
                path="/v1/opportunities",
                response_root_key="data",
                params={"limit": 100},
            )
        },
        pagination=PaginationConfig(
            style="cursor",
            cursor_request_param="offset",
            cursor_response_path="next",
        ),
    )
    records = [
        record
        async for record in GenericFetcher(
            config,
            "api-key",
            transport=httpx.MockTransport(handler),
        ).records("candidates")
    ]

    assert records == [{"id": "one"}, {"id": "two"}]
    assert requests[1].url.params["offset"] == "opaque.next.token"


@pytest.mark.anyio
async def test_fetcher_follows_workable_full_next_url_and_sets_limit() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.params.get("page") == "2":
            return httpx.Response(
                200,
                json={"candidates": [{"id": "two"}], "paging": {}},
                request=request,
            )
        return httpx.Response(
            200,
            json={
                "candidates": [{"id": "one"}],
                "paging": {"next": "https://example.test/candidates?page=2"},
            },
            request=request,
        )

    config = ConnectorConfig(
        id="workable",
        name="Workable",
        base_url="https://example.test",
        auth=ConnectorAuth(type="bearer"),
        endpoints={
            "candidates": ConnectorEndpoint(
                path="/candidates",
                response_root_key="candidates",
                pagination=PaginationConfig(
                    style="cursor",
                    cursor_response_path="paging.next",
                    cursor_is_url=True,
                    page_size_param="limit",
                    page_size=100,
                ),
            )
        },
    )

    records = [
        record
        async for record in GenericFetcher(
            config,
            "token",
            transport=httpx.MockTransport(handler),
        ).records("candidates")
    ]

    assert records == [{"id": "one"}, {"id": "two"}]
    assert requests[0].url.params["limit"] == "100"
    assert "limit" not in requests[1].url.params


@pytest.mark.anyio
async def test_fetcher_formats_bamboohr_new_since_checkpoint() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[], request=request)

    config = ConnectorConfig(
        id="bamboohr",
        name="BambooHR",
        base_url="https://example.test",
        endpoints={
            "candidates": ConnectorEndpoint(
                path="/applications",
                pagination=PaginationConfig(
                    style="page",
                    page_size_param=None,
                    since_param_name="newSince",
                    since_format="%Y-%m-%d %H:%M:%S",
                ),
            )
        },
    )

    records = [
        record
        async for record in GenericFetcher(
            config,
            transport=httpx.MockTransport(handler),
        ).records("candidates", since="2026-09-17T07:04:01+00:00")
    ]

    assert records == []
    assert requests[0].url.params["newSince"] == "2026-09-17 07:04:01"


@pytest.mark.anyio
async def test_fetcher_formats_lever_checkpoint_as_unix_milliseconds() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"data": []}, request=request)

    config = ConnectorConfig(
        id="lever",
        name="Lever",
        base_url="https://example.test",
        endpoints={
            "candidates": ConnectorEndpoint(
                path="/opportunities",
                response_root_key="data",
                pagination=PaginationConfig(
                    style="cursor",
                    since_param_name="updated_at_start",
                    since_format="unix_ms",
                ),
            )
        },
    )

    records = [
        record
        async for record in GenericFetcher(
            config,
            transport=httpx.MockTransport(handler),
        ).records("candidates", since="1970-01-01T00:00:01+00:00")
    ]

    assert records == []
    assert requests[0].url.params["updated_at_start"] == "1000"


def test_lever_adapter_builds_linked_canonical_entities() -> None:
    bundle = adapt_provider_bundle(
        "lever",
        {
            "candidate": [
                {
                    "id": "opportunity-1",
                    "contact": "contact-1",
                    "name": "Ada Lovelace",
                    "emails": ["ada@example.com"],
                    "phones": [{"value": "+15551234567"}],
                    "stage": "stage-1",
                    "applications": [{"id": "application-1", "posting": "job-1"}],
                }
            ],
            "resume": [
                {
                    "id": "resume-1",
                    "candidate_id": "opportunity-1",
                    "file": {
                        "name": "ada.pdf",
                        "downloadUrl": "https://files.example.test/ada.pdf",
                    },
                }
            ],
            "interview": [],
            "note": [],
        },
    )
    registry = load_connector_registry(CONFIG_DIR)
    mapping = registry["lever"].mappings

    candidate = CanonicalCandidate.model_validate(
        _mapped(bundle["candidate"][0], mapping["candidate"])
    )
    assert candidate.external_candidate_id == "contact-1"
    assert candidate.first_name == "Ada"
    assert candidate.last_name == "Lovelace"
    assert bundle["application"][0]["candidate_id"] == "contact-1"
    assert bundle["application"][0]["posting"] == "job-1"
    assert bundle["resume"][0]["candidate_id"] == "contact-1"


def test_smartrecruiters_adapter_exposes_application_and_stage_rows() -> None:
    bundle = adapt_provider_bundle(
        "smartrecruiters",
        {
            "candidate": [
                {
                    "id": "candidate-1",
                    "firstName": "Grace",
                    "lastName": "Hopper",
                    "email": "grace@example.com",
                    "jobs": [
                        {
                            "id": "application-1",
                            "job": {"id": "job-1"},
                            "status": {"id": "stage-1", "name": "Interview"},
                        }
                    ],
                }
            ]
        },
    )

    assert bundle["application"][0]["candidateId"] == "candidate-1"
    assert bundle["application"][0]["jobId"] == "job-1"
    assert bundle["stage"][0] == {
        "id": "stage-1",
        "jobId": "job-1",
        "name": "Interview",
        "position": 0,
    }


def test_bamboohr_adapter_normalizes_flat_application_and_resume() -> None:
    bundle = adapt_provider_bundle(
        "bamboohr",
        {
            "candidate": [
                {
                    "id": "application-1",
                    "applicant_id": "candidate-1",
                    "first_name": "Katherine",
                    "last_name": "Johnson",
                    "email": "kj@example.com",
                    "job_id": "job-1",
                    "job_title": "Engineer",
                    "applicationStatusId": "status-1",
                    "statusName": "New",
                    "resume": {
                        "id": "resume-1",
                        "name": "resume.pdf",
                        "downloadUrl": "https://files.example.test/resume.pdf",
                    },
                }
            ]
        },
    )

    candidate = bundle["candidate"][0]
    assert candidate["applicant"]["id"] == "candidate-1"
    assert candidate["job"]["id"] == "job-1"
    assert bundle["application"][0]["status"]["id"] == "status-1"
    assert bundle["resume"][0]["candidate_id"] == "candidate-1"


def test_bamboohr_adapter_coerces_numeric_ids_and_phone_number() -> None:
    bundle = adapt_provider_bundle(
        "bamboohr",
        {
            "candidate": [
                {
                    "id": 46,
                    "job": {"id": 21, "title": {"label": "Engineer"}},
                    "status": {"id": 1, "label": "New"},
                    "applicant": {
                        "id": 108,
                        "firstName": "Kim",
                        "lastName": "Lee",
                        "email": "kim@example.com",
                        "phoneNumber": "+44 7700 123456",
                    },
                }
            ]
        },
    )

    candidate = bundle["candidate"][0]
    assert candidate["applicant"]["id"] == "108"
    assert candidate["applicant"]["phone"] == "+44 7700 123456"
    assert candidate["job"]["id"] == "21"
    assert candidate["status"]["id"] == "1"


def test_bamboohr_adapter_normalizes_job_title_object() -> None:
    bundle = adapt_provider_bundle(
        "bamboohr",
        {"job": [{"id": 21, "title": {"id": None, "label": "Customer Success Advocate"}}]},
    )

    assert bundle["job"] == [{"id": "21", "title": "Customer Success Advocate"}]


def test_greenhouse_adapter_links_current_stage_and_application_children() -> None:
    bundle = adapt_provider_bundle(
        "greenhouse",
        {
            "application": [{"id": "app-1", "candidate_id": "candidate-1", "job_id": "job-1"}],
            "application_stage": [
                {
                    "application": {"id": "app-1"},
                    "job_interview_stage": {"id": "stage-1"},
                    "current": True,
                }
            ],
            "resume": [{"id": "resume-1", "application_id": "app-1"}],
            "interview": [{"id": "interview-1", "application": {"id": "app-1"}}],
        },
    )

    assert bundle["application"][0]["job_interview_stage_id"] == "stage-1"
    assert bundle["resume"][0]["candidate_id"] == "candidate-1"
    assert bundle["interview"][0]["job_id"] == "job-1"
    assert "application_stage" not in bundle


def test_greenhouse_activity_feed_normalizes_email_and_note_history() -> None:
    bundle = adapt_provider_bundle(
        "greenhouse",
        {
            "candidate": [
                {
                    "id": "candidate-1",
                    "email_addresses": [{"value": "ada@example.com"}],
                }
            ],
            "message_activity_feed": [
                {
                    "candidate_id": "candidate-1",
                    "emails": [
                        {
                            "id": "email-1",
                            "created_at": "2026-09-01T09:00:00Z",
                            "from": "ada@example.com",
                            "to": "recruiter@example.com",
                            "subject": "Re: Interview",
                            "body": "Thanks for the update",
                        }
                    ],
                    "notes": [
                        {
                            "id": "note-1",
                            "created_at": "2026-09-01T09:01:00Z",
                            "body": "Recruiter follow-up",
                        }
                    ],
                },
                {
                    "id": "email-2",
                    "candidate_id": "candidate-1",
                    "type": "email",
                    "created_at": "2026-09-01T09:02:00Z",
                    "from": "recruiter@example.com",
                    "to": "ada@example.com",
                    "subject": "Next steps",
                    "body": "Here are the next steps.",
                },
            ],
        },
    )

    assert [row["provider_message_id"] for row in bundle["message"]] == [
        "email:email-1",
        "note:note-1:0",
        "email:email-2",
    ]
    assert bundle["message"][0]["direction"] == "inbound"
    assert bundle["message"][1]["direction"] == "outbound"


def test_lever_note_threads_are_available_in_message_history() -> None:
    bundle = adapt_provider_bundle(
        "lever",
        {
            "candidate": [
                {
                    "id": "opportunity-1",
                    "contact": "candidate-1",
                    "name": "Ada Lovelace",
                    "emails": ["ada@example.com"],
                }
            ],
            "note": [
                {
                    "id": "note-1",
                    "candidate_id": "opportunity-1",
                    "text": "Recruiter note",
                    "fields": [
                        {
                            "value": "Please arrange a screen.",
                            "createdAt": 1_725_177_600_000,
                        }
                    ],
                }
            ],
        },
    )

    assert bundle["message"] == [
        {
            "provider_message_id": "note:note-1:0",
            "external_candidate_id": "candidate-1",
            "direction": "outbound",
            "sender_email": None,
            "recipient_email": None,
            "subject": "Recruiter note",
            "body_text": "Please arrange a screen.",
            "body_html": None,
            "sent_at": 1_725_177_600_000,
            "email_message_id": None,
            "in_reply_to": None,
            "references_header": None,
        }
    ]


def test_workable_activity_messages_normalize_without_stage_events() -> None:
    bundle = adapt_provider_bundle(
        "workable",
        {
            "candidate": [{"id": "candidate-1", "email": "ada@example.com"}],
            "message": [
                {
                    "id": "comment-1",
                    "candidate_id": "candidate-1",
                    "action": "comment",
                    "created_at": "2026-09-01T09:00:00Z",
                    "body": "Candidate left a note",
                },
                {
                    "id": "stage-1",
                    "candidate_id": "candidate-1",
                    "action": "moved",
                    "created_at": "2026-09-01T09:01:00Z",
                    "body": "Stage changed",
                },
            ],
        },
    )

    assert len(bundle["message"]) == 1
    assert bundle["message"][0]["provider_message_id"] == "comment:comment-1"


def test_imported_message_html_is_rebuilt_without_scripts_or_event_handlers() -> None:
    plain, safe_html = sanitize_imported_message_content(
        '<p>Hello <img src=x onerror="alert(1)"><a href="javascript:alert(2)">there</a></p><script>steal()</script>'
    )

    assert plain == "Hello there"
    assert safe_html == '<p>Hello <a>there</a></p>'


def test_named_provider_url_validation_blocks_wrong_hosts() -> None:
    assert (
        validate_provider_base_url("workable", "https://onehash-1.workable.com/")
        == "https://onehash-1.workable.com"
    )
    with pytest.raises(ProviderConnectionError):
        validate_provider_base_url("workable", "https://workable.example.com")
    with pytest.raises(ProviderConnectionError):
        validate_provider_base_url("bamboohr", "https://a.b.bamboohr.com")


@pytest.mark.anyio
async def test_greenhouse_client_credentials_exchange_returns_access_token() -> None:
    request_data: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        request_data["authorization"] = request.headers["Authorization"]
        request_data["body"] = request.content.decode()
        return httpx.Response(200, json={"access_token": "fresh-token"}, request=request)

    token = await issue_greenhouse_access_token(
        "client-id",
        "client-secret",
        transport=httpx.MockTransport(handler),
    )

    assert token == "fresh-token"
    assert request_data["authorization"].startswith("Basic ")
    assert request_data["body"] == "grant_type=client_credentials"


@pytest.mark.anyio
async def test_connection_check_validates_every_top_level_provider_route() -> None:
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        return httpx.Response(200, json=[], request=request)

    config = ConnectorConfig(
        id="example",
        name="Example",
        base_url="https://example.test",
        auth=ConnectorAuth(type="bearer"),
        endpoints={
            "jobs": ConnectorEndpoint(path="/jobs"),
            "candidates": ConnectorEndpoint(path="/candidates"),
            "candidate_details": ConnectorEndpoint(path="/candidates/{candidate_id}"),
        },
    )

    await validate_provider_connection(
        "example",
        config,
        "https://example.test",
        "token",
        transport=httpx.MockTransport(handler),
    )

    assert paths == ["/jobs", "/candidates"]


def test_application_status_normalizes_provider_labels() -> None:
    assert _normalize_application_status(None) == "submitted"
    assert _normalize_application_status("New") == "submitted"
    assert _normalize_application_status("Schedule Interview") == "in_review"
    assert _normalize_application_status("Hired") == "hired"
    assert _normalize_application_status({"label": "Rejected"}) == "rejected"


def test_generic_connector_accepts_multi_entity_endpoint_configuration() -> None:
    body = GenericAtsConfigCreate(
        display_name="Example ATS",
        base_url="https://ats.example.test",
        api_key="secret",
        candidates_endpoint_path="/candidates",
        endpoint_config={
            "jobs": {"path": "/jobs", "response_root_key": "items"},
            "candidates": {"path": "/candidates", "response_root_key": "items"},
            "applications": {"path": "/applications", "response_root_key": "items"},
        },
    )

    assert set(body.endpoint_config) == {"jobs", "candidates", "applications"}


def test_mcp_tool_selection_avoids_detail_tools_with_required_ids() -> None:
    tools = [
        {
            "name": "get_application_details",
            "inputSchema": {
                "type": "object",
                "properties": {"applicationId": {"type": "string"}},
                "required": ["applicationId"],
            },
        },
        {
            "name": "get_applications",
            "inputSchema": {
                "type": "object",
                "properties": {"limit": {"type": "integer"}},
            },
        },
        {
            "name": "get_job_summaries",
            "inputSchema": {"type": "object", "properties": {}},
        },
    ]

    selected = _select_tools(tools, None)

    assert selected["application"]["name"] == "get_applications"
    assert "candidate" not in selected
    assert "job" not in selected  # Summary-only tools need explicit hydration.
