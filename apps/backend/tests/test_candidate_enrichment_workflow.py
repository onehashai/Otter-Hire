from datetime import timedelta
from unittest.mock import AsyncMock

import pytest

from app.temporal.candidate_enrichment.types import CandidateEnrichmentInput
from app.temporal.candidate_enrichment.workflow import CandidateEnrichmentWorkflow


@pytest.mark.asyncio
async def test_rate_limit_uses_supported_temporal_timer(monkeypatch):
    execute_activity = AsyncMock(
        side_effect=[
            {"avatar_state": "rate_limited", "retry_after_seconds": 900},
            {"avatar_state": "found"},
        ]
    )
    wait_condition = AsyncMock(side_effect=TimeoutError)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.execute_activity", execute_activity)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.wait_condition", wait_condition)

    result = await CandidateEnrichmentWorkflow().run(
        CandidateEnrichmentInput(org_id="org", candidate_id="candidate")
    )

    assert result["avatar_state"] == "found"
    wait_condition.assert_awaited_once()
    assert wait_condition.await_args.kwargs["timeout"] == timedelta(seconds=900)


@pytest.mark.asyncio
async def test_rate_limit_retry_delay_is_capped(monkeypatch):
    execute_activity = AsyncMock(
        side_effect=[
            {"avatar_state": "rate_limited", "retry_after_seconds": 86_400},
            {"avatar_state": "found"},
        ]
    )
    wait_condition = AsyncMock(side_effect=TimeoutError)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.execute_activity", execute_activity)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.wait_condition", wait_condition)

    await CandidateEnrichmentWorkflow().run(
        CandidateEnrichmentInput(org_id="org", candidate_id="candidate")
    )

    assert wait_condition.await_args.kwargs["timeout"] == timedelta(hours=1)


@pytest.mark.asyncio
async def test_repeated_rate_limits_continue_as_new(monkeypatch):
    class ContinueRun(Exception):
        pass

    execute_activity = AsyncMock(
        return_value={"avatar_state": "rate_limited", "retry_after_seconds": 900}
    )
    wait_condition = AsyncMock(side_effect=TimeoutError)

    def continue_as_new(input_data):
        raise ContinueRun()

    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.execute_activity", execute_activity)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.wait_condition", wait_condition)
    monkeypatch.setattr("app.temporal.candidate_enrichment.workflow.workflow.continue_as_new", continue_as_new)

    with pytest.raises(ContinueRun):
        await CandidateEnrichmentWorkflow().run(
            CandidateEnrichmentInput(org_id="org", candidate_id="candidate")
        )

    assert execute_activity.await_count == 20
    assert wait_condition.await_count == 19
