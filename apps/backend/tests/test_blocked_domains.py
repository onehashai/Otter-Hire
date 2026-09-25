from unittest.mock import AsyncMock, Mock

import pytest

from app.services.blocked_domains import (
    domain_is_blocked,
    get_blocked_sender_domain,
    normalize_blocked_domain,
    sender_domain_from_email,
)


def test_normalize_blocked_domain_strips_email_prefix_and_wildcard() -> None:
    assert normalize_blocked_domain("  @*.Naukri.com. ") == "naukri.com"


def test_normalize_blocked_domain_rejects_an_email_address() -> None:
    with pytest.raises(ValueError):
        normalize_blocked_domain("applicant@naukri.com")


def test_blocked_domain_matches_exact_domain_and_subdomain() -> None:
    blocked = {"naukri.com"}
    assert domain_is_blocked("naukri.com", blocked)
    assert domain_is_blocked("mail.naukri.com", blocked)
    assert not domain_is_blocked("notnaukri.com", blocked)


def test_sender_domain_from_rfc822_address() -> None:
    assert sender_domain_from_email("Naukri Alerts <jobs@mail.naukri.com>") == "mail.naukri.com"


@pytest.mark.asyncio
async def test_get_blocked_sender_domain_uses_organization_domains_only() -> None:
    scalar_result = Mock()
    scalar_result.all.return_value = ["naukri.com"]
    result = Mock()
    result.scalars.return_value = scalar_result
    db = AsyncMock()
    db.execute.return_value = result

    assert (
        await get_blocked_sender_domain(
            db,
            org_id="00000000-0000-0000-0000-000000000001",
            sender_email="candidate@jobs.naukri.com",
        )
    ) == "jobs.naukri.com"
    db.execute.assert_awaited_once()
