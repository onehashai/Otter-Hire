from app.models.candidate import Candidate
from scripts.backfill_indian_candidate_phones import _candidate_phone_update


def _candidate(
    phone: str | None, *, address: str | None = None, email: str = "candidate@gmail.com"
) -> Candidate:
    return Candidate(
        phone=phone,
        address=address,
        email=email,
        parsed_resume={"personal": {"phone": phone, "address": address}},
    )


def test_backfill_reclassifies_legacy_us_prefix_for_indian_dataset() -> None:
    assert _candidate_phone_update(
        _candidate("+1 987-654-3210", address="Bengaluru, India")
    ) == "+91 98765 43210"


def test_backfill_respects_conflicting_us_location() -> None:
    assert _candidate_phone_update(
        _candidate("+1 555-512-8834", address="Raleigh, NC")
    ) is None


def test_backfill_leaves_correct_indian_international_number_untouched() -> None:
    assert _candidate_phone_update(
        _candidate("+91 98765 43210", address="Bengaluru, India")
    ) is None


def test_backfill_preserves_unprefixed_number_without_country_context() -> None:
    assert _candidate_phone_update(_candidate("9876543210")) is None


def test_backfill_preserves_other_international_codes() -> None:
    assert _candidate_phone_update(
        _candidate("+44 20 7946 0958", address="London, UK")
    ) is None


def test_backfill_keeps_us_number_when_resume_location_is_us() -> None:
    assert _candidate_phone_update(
        _candidate("+1 555-512-8834", address="Raleigh, NC")
    ) is None
