"""LinkedIn contracts: no database writes or live provider requests."""

import base64
import hashlib
import hmac
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import httpx
from fastapi import HTTPException, Response

from app.core.config import settings
from app.integrations.linkedin import leads, oauth, service
from app.api.v1.internal.endpoints import linkedin as endpoints


class FakeRedis:
    def __init__(self):
        self.data = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def set(self, key, value, **kwargs):
        assert kwargs["ex"] == 600 and kwargs["nx"]
        self.data[key] = value.encode()

    async def get(self, key):
        return self.data.get(key)

    async def getdel(self, key):
        return self.data.pop(key, None)


class LinkedInContractTests(unittest.IsolatedAsyncioTestCase):
    def test_authorization_encoding_and_pkce(self):
        with patch.object(settings, "linkedin_client_id", "client"), patch.object(settings, "linkedin_client_secret", "secret"):
            query = parse_qs(urlsplit(service.get_authorization_url("a+b&state", "verifier", service.requested_scopes(True))).query)
        self.assertEqual(query["state"], ["a+b&state"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        expected = base64.urlsafe_b64encode(hashlib.sha256(b"verifier").digest()).rstrip(b"=").decode()
        self.assertEqual(query["code_challenge"], [expected])
        self.assertNotIn("r_ads_leadgen_automation", query["scope"][0])
        self.assertNotIn("rw_ads", query["scope"][0])

    async def test_state_is_browser_bound_and_single_use(self):
        redis = FakeRedis()
        with patch.object(oauth.Redis, "from_url", return_value=redis):
            state, binding, verifier = await oauth.create_request("org", "user", ["openid"])
            with self.assertRaises(HTTPException):
                await oauth.consume_request(state, "wrong browser")
            data = await oauth.consume_request(state, binding)
            self.assertEqual(data["org_id"], "org")
            self.assertEqual(data["verifier"], verifier)
            with self.assertRaises(HTTPException):
                await oauth.consume_request(state, binding)

    async def test_expired_state_is_rejected(self):
        with patch.object(oauth.Redis, "from_url", return_value=FakeRedis()):
            with self.assertRaises(HTTPException):
                await oauth.consume_request("expired", "browser")

    async def test_connect_sets_secure_http_only_cookie(self):
        response = Response()
        user = SimpleNamespace(org_id=uuid4(), id=uuid4())
        with patch.object(settings, "linkedin_client_id", "client"), patch.object(settings, "linkedin_client_secret", "secret"), patch.object(settings, "api_base_url", "https://smartats.in"), patch.object(oauth, "create_request", AsyncMock(return_value=("state", "binding", "verifier"))):
            result = await endpoints.connect_linkedin(response, False, user)
        self.assertEqual(result["callback_origin"], "https://smartats.in")
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertIn("Secure", response.headers["set-cookie"])
        self.assertIn("SameSite=lax", response.headers["set-cookie"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    async def test_callback_rejects_unvalidated_state_before_token_exchange(self):
        with patch.object(oauth, "consume_request", AsyncMock(side_effect=HTTPException(400, "invalid"))), patch.object(service, "exchange_code_for_token", AsyncMock()) as exchange:
            with self.assertRaises(HTTPException):
                await endpoints.linkedin_callback(SimpleNamespace(cookies={}), "code", "forged:org", None, AsyncMock())
            exchange.assert_not_awaited()

    def test_callback_message_is_escaped_and_origin_restricted(self):
        response = endpoints.callback_response(False, "state", "</script><script>bad()</script>")
        text = response.body.decode()
        self.assertNotIn("</script><script>bad", text)
        self.assertNotIn(", '*'", text)
        self.assertIn("\\u003c", text)

    async def test_webhook_challenge(self):
        with patch.object(settings, "linkedin_client_secret", "secret"), patch.object(settings, "feature_linkedin_applicant_ingestion", True):
            response = await endpoints.validate_webhook("challenge")
        self.assertEqual(response["challengeResponse"], hmac.new(b"secret", b"challenge", hashlib.sha256).hexdigest())

    def test_notification_signature_uses_exact_body_and_fails_closed(self):
        body = b'{"type": "LEAD_ACTION"}'
        digest = hmac.new(b"secret", b"hmacsha256=" + body, hashlib.sha256).hexdigest()
        with patch.object(settings, "linkedin_client_secret", "secret"):
            self.assertTrue(service.verify_linkedin_webhook_signature(body, digest))
            self.assertFalse(service.verify_linkedin_webhook_signature(body + b" ", digest))
            self.assertFalse(service.verify_linkedin_webhook_signature(body, None))
        with patch.object(settings, "linkedin_client_secret", None):
            self.assertFalse(service.verify_linkedin_webhook_signature(body, digest))

    def test_answer_mapping_handles_real_lead_response_schema(self):
        form = {"content": {"questions": [{"questionId": i, "predefinedField": field} for i, field in enumerate(["FIRST_NAME", "LAST_NAME", "EMAIL", "PHONE_NUMBER", "EXPERIENCE"])]}}
        lead = {"formResponse": {"answers": [{"questionId": i, "answerDetails": {"textQuestionAnswer": {"answer": value}}} for i, value in enumerate(["Kim", "Lee", "kim@example.com", "+12025550123", "5 years"])]}}
        self.assertEqual(leads.map_answers(lead, form), {"name": "Kim Lee", "email": "kim@example.com", "phone": "+12025550123", "experience": "5 years"})

    def test_missing_email_is_not_invented(self):
        with self.assertRaises(HTTPException) as ctx:
            leads.map_answers({}, {})
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_foreign_owner_cannot_import(self):
        cred = SimpleNamespace(config={"lead_subscription": {"owner": {"sponsoredAccount": "urn:li:sponsoredAccount:1"}, "lead_type": "SPONSORED", "status": "active"}})
        db = SimpleNamespace(execute=AsyncMock(return_value=Mock(scalar_one_or_none=Mock(return_value=cred))))
        with self.assertRaises(HTTPException) as ctx:
            await leads.ingest_notification(db, str(uuid4()), {"owner": {"sponsoredAccount": "urn:li:sponsoredAccount:2"}, "leadType": "SPONSORED"})
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_missing_lead_permission_is_actionable(self):
        cred = SimpleNamespace(config={"scopes": ["openid"]})
        with patch.object(settings, "feature_linkedin_applicant_ingestion", True), patch.object(leads, "get_linkedin_credential", AsyncMock(return_value=cred)):
            with self.assertRaises(HTTPException) as ctx:
                await leads.subscribe(AsyncMock(), "org", "123")
        self.assertEqual(ctx.exception.status_code, 403)

    async def test_lead_creates_candidate_and_replay_reuses_it(self):
        owner = {"sponsoredAccount": "urn:li:sponsoredAccount:1"}
        cred = SimpleNamespace(org_id=uuid4(), config={"lead_subscription": {"owner": owner, "lead_type": "SPONSORED", "status": "active"}})
        lead = {"owner": owner, "leadType": "SPONSORED", "versionedLeadGenFormUrn": "urn:li:versionedLeadGenForm:(urn:li:leadGenForm:12,1)",
                "formResponse": {"answers": [{"questionId": 1, "answerDetails": {"textQuestionAnswer": {"answer": "kim@example.com"}}}]}}
        form = {"owner": owner, "versionId": 1, "content": {"questions": [{"questionId": 1, "predefinedField": "EMAIL"}]}}
        event = {"owner": owner, "leadType": "SPONSORED", "leadAction": "CREATED", "leadGenFormResponse": "urn:li:leadGenFormResponse:abc"}
        created = []
        def add(candidate):
            candidate.id = uuid4()
            created.append(candidate)
        db = SimpleNamespace(execute=AsyncMock(side_effect=[Mock(scalar_one_or_none=Mock(return_value=cred)), Mock(scalar_one_or_none=Mock(return_value=None))]), add=Mock(side_effect=add), flush=AsyncMock(), commit=AsyncMock())
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get.side_effect = [httpx.Response(200, json=lead), httpx.Response(200, json=form)] * 2
        with patch.object(leads, "credential_token", return_value="token"), patch.object(leads.httpx, "AsyncClient", return_value=client):
            candidate_id = await leads.ingest_notification(db, str(uuid4()), event)
            self.assertEqual(created[0].source, "linkedin_apply")
            self.assertEqual(created[0].email, "kim@example.com")
            self.assertEqual(created[0].org_id, cred.org_id)
            db.execute.side_effect = [Mock(scalar_one_or_none=Mock(return_value=cred)), Mock(scalar_one_or_none=Mock(return_value=created[0]))]
            self.assertEqual(await leads.ingest_notification(db, str(uuid4()), event), candidate_id)
        db.add.assert_called_once()

    async def test_unverified_company_page_cannot_be_selected(self):
        with patch.object(service, "get_linkedin_credential", AsyncMock(return_value=SimpleNamespace())), patch.object(service, "credential_token", return_value="token"), patch.object(service, "get_linkedin_organizations", AsyncMock(return_value=[{"id": "1"}])):
            with self.assertRaises(HTTPException) as ctx:
                await service.complete_linkedin_setup(AsyncMock(), SimpleNamespace(org_id="org"), "2", "forged", "", None)
        self.assertEqual(ctx.exception.status_code, 403)

    async def post_job(self, response=None, exception=None, persisted=("not_posted", None)):
        job = SimpleNamespace(id=uuid4(), org_id=uuid4(), title="Engineer", status="open", visibility="public", linkedin_sync_status="not_posted", linkedin_external_job_id=None, linkedin_last_error=None)
        db = SimpleNamespace(execute=AsyncMock(return_value=Mock(one=Mock(return_value=persisted))), commit=AsyncMock())
        client = AsyncMock()
        client.post = AsyncMock(return_value=response, side_effect=exception)
        client.__aenter__.return_value = client
        with patch.object(settings, "feature_linkedin_distribution", True), patch.object(service, "get_linkedin_credential", AsyncMock(return_value=SimpleNamespace(config={"organization": {"id": "123"}}))), patch.object(service, "get_linkedin_status", AsyncMock(return_value={"can_post": True})), patch.object(service, "credential_token", return_value="token"), patch.object(service.httpx, "AsyncClient", return_value=client):
            await service.sync_job_distribution_to_linkedin(db, job)
        return job, client

    async def test_post_succeeds_only_with_real_provider_id(self):
        job, client = await self.post_job(httpx.Response(201, headers={"x-restli-id": "urn:li:share:123"}))
        self.assertEqual(job.linkedin_sync_status, "posted")
        self.assertEqual(job.linkedin_external_job_id, "urn:li:share:123")
        self.assertIn(str(job.id), client.post.call_args.kwargs["json"]["commentary"])

    async def test_permission_failure_is_not_fake_success(self):
        job, _ = await self.post_job(httpx.Response(403))
        self.assertEqual(job.linkedin_sync_status, "failed")
        self.assertIsNone(job.linkedin_external_job_id)

    async def test_ambiguous_timeout_is_not_blindly_reposted(self):
        job, _ = await self.post_job(exception=httpx.ReadTimeout("timeout"))
        self.assertEqual(job.linkedin_sync_status, "posting")
        self.assertIsNone(job.linkedin_external_job_id)
        _, client = await self.post_job(persisted=("posting", None))
        client.post.assert_not_awaited()

    async def test_existing_real_post_is_not_duplicated(self):
        _, client = await self.post_job(persisted=("posted", "urn:li:share:123"))
        client.post.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
