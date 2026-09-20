# Native MCP Migration Mappings

These mappings use the provider's MCP server, not the hidden Migration Bridge.
Authentication, provider permissions and a compatible tool schema are still required.
An available mapping is not evidence of a successful live-account import.

## Coverage

| Provider | Read strategy | Mapped records | Verification limits |
| --- | --- | --- | --- |
| Workable | Accounts, jobs, job stages, candidates, candidate details | Jobs, stages, candidates and exposed resumes; existing candidate-to-job commit flow creates applications | Fixture-tested. OAuth callback approval and tenant permissions still required. Multiple accounts need account selection. |
| Ashby | Job/application collections with detail hydration | Jobs, candidates, applications, stages and exposed resumes | Fixture-tested. Requires collection/detail tools, not candidate search alone. |
| Greenhouse | Explicit collection tool names | Jobs, candidates, applications, interview stages; optional current application stages, resume attachments, notes and interviews | Fixture-tested. OAuth scopes and callback/client approval required. |
| Pinpoint | MCP `execute-request`, restricted to fixed GET collection paths | Jobs, candidates, applications, included stages, CVs, application comments and application interviews | Public tool and API schemas inspected. Private tenant responses not live-tested. |
| Ninehire | `get_recruitments`, `get_recruitment`, `get_applicant_progresses`, `get_applicant_progress` | Recruitments as jobs, applicant identities, progress records as applications, steps as stages, exposed resume attachments | Tool names documented. Argument/response variants implemented with synthetic fixtures; real tool schemas and data still need account validation. Unsupported shapes fail explicitly. Notes are not exposed by the documented native MCP. |
| Zoho Recruit | `searchRecords`, only when its discovered schema supports unfiltered paginated module reads | Job_Openings, Candidates, Applications and application-status stages | Conditional mapping, not a claim of full native support. Criteria-required search tools or servers without Applications access remain limited. Notes, interviews and attachment downloads are not implemented in this adapter. |

Zoho `getAllProfiles` refers to access profiles, not candidates. Search results cannot
be assumed to enumerate an entire account. The importer must not fabricate a
search criterion or report a complete migration for a search-only server.

API connectors retain their separate configuration mappings and tests. This change
does not implement Workday/iCIMS tenant setup, add an unofficial MCP server for an
API-only vendor, or bypass vendor subscriptions.

## Safety And Relationships

- MCP tool errors and malformed collections fail the sync instead of becoming empty successful batches.
- Tool discovery and record fetching follow continuation pages, with repeated-cursor guards.
- Collection selection does not treat applications as candidates or job summaries as full jobs.
- Pinpoint requests cannot change method, account host or collection path through pagination links.
- New Pinpoint/Ninehire/Zoho external IDs are provider-prefixed, including relationship IDs.
- Existing Workable, Ashby and Greenhouse IDs remain unchanged to preserve existing imports.
- Missing job/candidate relationships in the new adapters stop the import rather than inventing links.
- Unsupported entity types remain unavailable; they are not represented as successfully imported empty lists.
- No source-system write tools are used. Local changes still require the existing batch approval flow.

## Verification

Run from `apps/backend`:

```sh
venv/bin/pytest -q tests/test_mcp_oauth.py tests/test_mcp_provider_mappings.py tests/test_migration_connector_contracts.py
```

These are mocked contract/mapping tests, not live-provider or database import tests.
Before enabling a connector for users, authorize a staging test account and verify:

1. Multiple pages and closed/archived jobs are retrieved where supported.
2. Preview counts match the provider and no required records are silently omitted.
3. Approval creates visible jobs/candidates and preserves application-stage links.
4. Resume download, parsing/scoring and candidate messaging work in the destination.
5. A second sync updates the same records without duplicates.
6. Missing permissions, token expiry and provider failures show actionable errors.

## Provider References

- [Pinpoint MCP and execution headers](https://developers.pinpointhq.com/docs/mcp)
- [Pinpoint jobs](https://developers.pinpointhq.com/reference/get-jobs)
- [Pinpoint applications](https://developers.pinpointhq.com/reference/get-applications)
- [Ninehire native MCP tool catalog](https://guide.ninehire.com/ko/articles/15078984-나인하이어-mcp-연동)
- [Zoho Recruit MCP actions](https://help.zoho.com/portal/en/kb/recruit/integrations/zoho-apps/zoho-mcp/articles/zoho-recruit-integration-with-zoho-mcp)
- [Zoho Recruit record API](https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html)
