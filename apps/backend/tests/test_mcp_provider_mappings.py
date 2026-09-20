from contextlib import asynccontextmanager
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest

from app.schemas.canonical import CanonicalCandidate
from app.services.migration import mcp_client
from app.services.migration.batch_service import REQUIRED_ENTITY_FIELDS
from app.services.migration.mcp_mapping import adapt_mcp_bundle
from app.services.migration.provider_adapter import adapt_provider_bundle


def tool(name, properties=(), required=()):
    return {
        "name": name,
        "inputSchema": {
            "type": "object",
            "properties": {name: {} for name in properties},
            "required": list(required),
        },
    }


def execute_tool():
    return {
        "name": "execute-request",
        "annotations": {"readOnlyHint": False},
        "inputSchema": {
            "properties": {"harRequest": {"properties": {"method": {}, "url": {}}}},
            "required": ["harRequest"],
        },
    }


def resource(kind, identifier, attributes=None, **relationships):
    return {
        "type": kind,
        "id": identifier,
        "attributes": attributes or {},
        "relationships": {key: {"data": value} for key, value in relationships.items()},
    }


def assert_canonical(bundle):
    for entity, rows in bundle.items():
        for row in rows:
            if entity == "candidate":
                CanonicalCandidate.model_validate(row)
                assert row.get("email") or row.get("phone")
            else:
                for key in REQUIRED_ENTITY_FIELDS[entity]:
                    assert row.get(key) not in (None, ""), (entity, key)
    candidates = {row["external_candidate_id"] for row in bundle["candidate"]}
    jobs = {row["external_job_id"] for row in bundle["job"]}
    for row in bundle["application"]:
        assert row["external_candidate_id"] in candidates
        assert row["external_job_id"] in jobs


class PinpointSession:
    def __init__(self, next_url=None):
        self.calls = []
        self.next_url = next_url

    async def call_tool(self, name, arguments):
        self.calls.append((name, arguments))
        assert name == "execute-request"
        request = arguments["harRequest"]
        assert request["method"] == "GET"
        assert "postData" not in request
        url = urlparse(request["url"])
        assert url.netloc == "test.pinpointhq.com"
        entity = url.path.rsplit("/", 1)[1]
        stage = resource("stages", "s1", {"name": "Interview", "position": 2})
        collections = {
            "jobs": [
                resource(
                    "jobs", "j1", {"title": "Engineer"}, stages=[{"type": "stages", "id": "s1"}]
                )
            ],
            "candidates": [
                resource("candidates", "c1", {"first_name": "Ada", "email": "ada@example.com"})
            ],
            "applications": [
                resource(
                    "applications",
                    "a1",
                    {
                        "attachments": [
                            {
                                "context": "cv",
                                "name": "ada.pdf",
                                "url": "https://files.example/ada.pdf",
                            }
                        ]
                    },
                    candidate={"type": "candidates", "id": "c1"},
                    job={"type": "jobs", "id": "j1"},
                    stage={"type": "stages", "id": "s1"},
                )
            ],
            "comments": [
                resource(
                    "comments",
                    "n1",
                    {"body_text": "Interview feedback"},
                    commentable={"type": "applications", "id": "a1"},
                )
            ],
            "interviews": [
                resource(
                    "interviews",
                    "i1",
                    {"start_at": "2026-09-18T10:00:00Z"},
                    interviewable={"type": "applications", "id": "a1"},
                )
            ],
        }
        payload = {
            "data": collections[entity],
            "included": [stage] if entity in {"jobs", "applications"} else [],
        }
        if entity == "jobs" and self.next_url:
            payload["links"] = {"next": self.next_url}
        return SimpleNamespace(structuredContent=payload)


@pytest.mark.asyncio
async def test_pinpoint_maps_all_entities_and_preserves_relationships():
    session = PinpointSession()
    assert mcp_client.assess_import_contract([execute_tool()], provider="pinpoint")["ready"]
    bundle = await mcp_client._fetch_pinpoint_bundle(
        session,
        [execute_tool()],
        {"X-Original-Host": "test.pinpointhq.com", "X-API-KEY": "test-key"},
    )
    assert_canonical(bundle)
    assert bundle["job"][0]["title"] == "Engineer"
    assert bundle["application"][0]["external_stage_id"] == "pinpoint:s1"
    assert bundle["resume"][0]["external_candidate_id"] == "pinpoint:c1"
    assert len(session.calls) == 5
    params = parse_qs(urlparse(session.calls[2][1]["harRequest"]["url"]).query)
    assert params["extra_fields[applications]"] == ["attachments"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example/data",
        "http://test.pinpointhq.com/api/v1/jobs",
        "https://test.pinpointhq.com/api/v1/users",
    ],
)
async def test_pinpoint_rejects_pagination_outside_read_allowlist(url):
    session = PinpointSession(url)
    with pytest.raises(ValueError, match="allowed collection"):
        await mcp_client._fetch_pinpoint_bundle(
            session,
            [execute_tool()],
            {"X-Original-Host": "test.pinpointhq.com", "X-API-KEY": "test-key"},
        )
    assert len(session.calls) == 1


def ninehire_tools():
    return [
        tool("get_recruitments", ("cursor",)),
        tool("get_recruitment", ("recruitmentId",), ("recruitmentId",)),
        tool("get_applicant_progresses", ("recruitmentId", "cursor"), ("recruitmentId",)),
        tool(
            "get_applicant_progress",
            ("recruitmentId", "applicantProgressId"),
            ("recruitmentId", "applicantProgressId"),
        ),
    ]


@pytest.mark.asyncio
async def test_ninehire_hydrates_recruitments_and_applicant_progresses():
    calls = []

    class Session:
        async def call_tool(self, name, args):
            calls.append((name, args))
            if name == "get_recruitments":
                payload = {"recruitments": [{"id": "j1", "name": "Engineer"}]}
            elif name == "get_recruitment":
                assert args == {"recruitmentId": "j1"}
                payload = {
                    "recruitment": {"id": "j1", "steps": [{"id": "s1", "name": "Interview"}]}
                }
            elif name == "get_applicant_progresses":
                assert args == {"recruitmentId": "j1"}
                payload = {"applicantProgresses": [{"id": "a1"}]}
            else:
                assert args == {"recruitmentId": "j1", "applicantProgressId": "a1"}
                payload = {
                    "applicantProgress": {
                        "id": "a1",
                        "stepId": "s1",
                        "applicant": {
                            "id": "c1",
                            "name": "Ada Lovelace",
                            "email": "ada@example.com",
                        },
                    }
                }
            return SimpleNamespace(structuredContent=payload)

    assert mcp_client.assess_import_contract(ninehire_tools(), provider="ninehire")["ready"]
    selected = mcp_client._select_provider_tools("ninehire", ninehire_tools())
    bundle = await mcp_client._fetch_ninehire_bundle(Session(), selected)
    assert_canonical(bundle)
    assert len(calls) == 4
    assert bundle["candidate"][0]["last_name"] == "Lovelace"
    assert bundle["application"][0]["external_stage_id"] == "ninehire:s1"
    assert "note" not in bundle  # Provider explicitly does not expose notes.


@pytest.mark.asyncio
async def test_zoho_paginates_modules_and_maps_lookup_ids():
    read = tool("ZohoRecruit_searchRecords", ("module", "page", "per_page"), ("module",))
    calls = []

    class Session:
        async def call_tool(self, name, args):
            calls.append((name, args))
            module = args["module"]
            page = args["page"]
            records = {
                "Job_Openings": [{"id": "j1", "Posting_Title": {"label": "Engineer"}}],
                "Candidates": [
                    {
                        "id": f"c{page}",
                        "First_Name": "Ada",
                        "Last_Name": "Lovelace",
                        "Email": f"ada{page}@example.com",
                    }
                ],
                "Applications": [
                    {
                        "id": "a1",
                        "$Candidate_Id": "c1",
                        "$Job_Opening_Id": "j1",
                        "Application_Status": "Interview",
                    }
                ],
            }
            return SimpleNamespace(
                structuredContent={
                    "data": records[module],
                    "info": {"page": page, "more_records": module == "Candidates" and page == 1},
                }
            )

    assert mcp_client.assess_import_contract([read], provider="zoho_recruit")["ready"]
    bundle = await mcp_client._fetch_zoho_bundle(Session(), {"records": read})
    assert_canonical(bundle)
    assert len(bundle["candidate"]) == 2
    assert bundle["job"][0]["title"] == "Engineer"
    assert bundle["application"][0]["external_candidate_id"] == "zoho_recruit:c1"
    assert len(calls) == 4


def test_zoho_search_criteria_are_not_invented_to_claim_full_import():
    read = tool("searchRecords", ("module", "criteria", "page"), ("module", "criteria"))
    contract = mcp_client.assess_import_contract([read], provider="zoho_recruit")
    assert not contract["ready"]
    assert "searchRecords" in contract["limitation"]


def test_zoho_does_not_use_job_title_as_job_id():
    with pytest.raises(ValueError, match="lookup"):
        adapt_mcp_bundle(
            "zoho_recruit",
            {
                "application": [
                    {"id": "a1", "Candidate_Name": "Ada", "Job_Opening_Name": "Engineer"}
                ]
            },
        )


def test_greenhouse_requires_applications_and_distinguishes_stages_from_jobs():
    tools = [
        tool("list_jobs"),
        tool("list_candidates"),
        tool("list_applications"),
        tool("list_job_interview_stages"),
        tool("list_application_stages"),
    ]
    contract = mcp_client.assess_import_contract(tools, provider="greenhouse")
    assert contract["ready"]
    assert contract["selected_tools"]["job"] == "list_jobs"
    assert contract["selected_tools"]["stage"] == "list_job_interview_stages"
    assert contract["selected_tools"]["application_stage"] == "list_application_stages"
    assert not mcp_client.assess_import_contract(tools[:2], provider="greenhouse")["ready"]


@pytest.mark.parametrize(
    "name",
    [
        "updateCandidateStatus",
        "commit_apply_applicant_tags",
        "cancelInterview",
        "send_candidate_email",
        "execute-request",
    ],
)
def test_mutating_tools_are_never_auto_selected(name):
    assert not mcp_client._is_read_tool(tool(name))


@pytest.mark.parametrize(
    "payload",
    [
        {"errors": [{"code": "unauthorized"}]},
        {"success": False},
        {"message": "Not authorized"},
        "not JSON",
        ["text"],
    ],
)
def test_provider_error_is_not_an_empty_successful_import(payload):
    with pytest.raises(ValueError):
        mcp_client._records_from_payload(payload, "candidate")


def test_mcp_is_error_flag_is_respected_without_echoing_private_data():
    with pytest.raises(ValueError, match="tool error") as error:
        mcp_client._result_payload(
            SimpleNamespace(isError=True, structuredContent={"secret": "do-not-log"})
        )
    assert "do-not-log" not in str(error.value)


@pytest.mark.asyncio
async def test_pagination_cannot_silently_repeat_first_page():
    class Session:
        async def call_tool(self, name, args):
            return SimpleNamespace(
                structuredContent={"data": [{"id": "c1"}], "next_cursor": "next"}
            )

    with pytest.raises(ValueError, match="no pagination"):
        await mcp_client._fetch_tool_pages(Session(), tool("list_candidates"), "candidate", None)
    with pytest.raises(ValueError, match="repeated pagination"):
        await mcp_client._fetch_tool_pages(
            Session(), tool("list_candidates", ("cursor",)), "candidate", None
        )


@pytest.mark.asyncio
async def test_discovers_every_page_of_tools(monkeypatch):
    class Session:
        async def list_tools(self, cursor=None):
            value = tool("list_candidates" if cursor else "list_jobs")
            return SimpleNamespace(
                tools=[SimpleNamespace(model_dump=lambda **kwargs: value)],
                nextCursor=None if cursor else "next",
            )

    @asynccontextmanager
    async def session(*args):
        yield Session()

    monkeypatch.setattr(mcp_client, "_session", session)
    result = await mcp_client.discover_tools("https://example.com/mcp")
    assert [item["name"] for item in result] == ["list_jobs", "list_candidates"]


@pytest.mark.asyncio
async def test_pinpoint_uses_numbered_pages_when_links_are_omitted():
    seen_pages = []

    class Session:
        async def call_tool(self, name, arguments):
            url = urlparse(arguments["harRequest"]["url"])
            page = int(parse_qs(url.query)["page[number]"][0])
            if url.path.endswith("/jobs"):
                seen_pages.append(page)
                rows = (
                    [resource("jobs", str(i), {"title": f"Job {i}"}) for i in range(100)]
                    if page == 1
                    else [resource("jobs", "100", {"title": "Final Job"})]
                )
            else:
                rows = []
            return SimpleNamespace(structuredContent={"data": rows})

    bundle = await mcp_client._fetch_pinpoint_bundle(
        Session(), [execute_tool()], {"X-Original-Host": "test.pinpointhq.com", "X-API-KEY": "test"}
    )
    assert seen_pages == [1, 2]
    assert len(bundle["job"]) == 101
    assert bundle["job"][-1]["external_job_id"] == "pinpoint:100"


def test_new_provider_external_ids_cannot_collide():
    pinpoint = adapt_mcp_bundle("pinpoint", {"job": [resource("jobs", "1", {"title": "Engineer"})]})
    ninehire = adapt_mcp_bundle("ninehire", {"job": [{"id": "1", "name": "Engineer"}]})
    zoho = adapt_mcp_bundle("zoho_recruit", {"job": [{"id": "1", "Posting_Title": "Engineer"}]})
    assert len({bundle["job"][0]["external_job_id"] for bundle in (pinpoint, ninehire, zoho)}) == 3


@pytest.mark.parametrize(
    "bundle",
    [{"job": [{"id": "j1"}]}, {"candidate": [{"name": "Ada"}]}, {"application": [{"id": "a1"}]}],
)
def test_ashby_does_not_silently_drop_unmappable_records(bundle):
    with pytest.raises(ValueError, match="missing"):
        adapt_provider_bundle("ashby", bundle)


def test_limits_respect_discovered_schema():
    read = tool("list_jobs", ("limit",))
    read["inputSchema"]["properties"]["limit"] = {"type": "integer", "maximum": 25}
    assert mcp_client._arguments_for_tool(read) == {"limit": 25}


def test_more_records_without_cursor_is_an_error():
    with pytest.raises(ValueError, match="continuation"):
        mcp_client._records_from_payload({"data": [{"id": "1"}], "has_more": True}, "job")


@pytest.mark.asyncio
async def test_native_dispatch_rejects_incompatible_server_before_any_fetch(monkeypatch):
    @asynccontextmanager
    async def session(*args):
        raise AssertionError("No network call should be made for an incompatible contract")
        yield

    monkeypatch.setattr(mcp_client, "_session", session)
    with pytest.raises(ValueError, match="cannot migrate"):
        await mcp_client.fetch_entity_bundle_from_mcp(
            "https://example.com/mcp",
            "token",
            {"tools": [tool("searchCandidates", ("criteria",), ("criteria",))]},
            provider="zoho_recruit",
        )


@pytest.mark.asyncio
async def test_greenhouse_dispatch_links_stages_and_resume_to_application(monkeypatch):
    payloads = {
        "list_jobs": {"jobs": [{"id": "j1", "name": "Engineer"}]},
        "list_candidates": {
            "candidates": [
                {"id": "c1", "first_name": "Ada", "email_addresses": [{"value": "ada@example.com"}]}
            ]
        },
        "list_applications": {"applications": [{"id": "a1", "candidate_id": "c1", "job_id": "j1"}]},
        "list_job_interview_stages": {
            "job_interview_stages": [{"id": "s1", "name": "Interview", "job_id": "j1"}]
        },
        "list_application_stages": {
            "application_stages": [
                {
                    "id": "as1",
                    "application_id": "a1",
                    "job_interview_stage_id": "s1",
                    "current": True,
                }
            ]
        },
        "list_attachments": {
            "attachments": [
                {
                    "id": "r1",
                    "type": "resume",
                    "application_id": "a1",
                    "url": "https://files.example/cv.pdf",
                },
                {"id": "r2", "type": "cover_letter"},
            ]
        },
    }

    class Session:
        async def call_tool(self, name, arguments):
            return SimpleNamespace(structuredContent=payloads[name])

    @asynccontextmanager
    async def session(*args):
        yield Session()

    monkeypatch.setattr(mcp_client, "_session", session)
    bundle = await mcp_client.fetch_entity_bundle_from_mcp(
        "https://mcp.greenhouse.io/mcp",
        "token",
        {"tools": [tool(name) for name in payloads]},
        provider="greenhouse",
    )
    assert bundle["application"][0]["job_interview_stage_id"] == "s1"
    assert len(bundle["resume"]) == 1
    assert bundle["resume"][0]["candidate_id"] == "c1"
    assert bundle["resume"][0]["job_id"] == "j1"
