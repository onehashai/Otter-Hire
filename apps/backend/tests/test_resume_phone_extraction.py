from types import SimpleNamespace

from app.services.resume.heuristics import (
    extract_location,
    extract_phone,
    infer_country_from_location,
    is_dummy_phone_number,
    is_phone_in_text,
    normalize_phone_with_country,
)
from app.services.resume.pipeline import _profile_from_heuristics
from app.temporal.inbound_email.activities import _contact_from_email_body


def test_extract_phone_preserves_opening_parenthesis() -> None:
    assert extract_phone("Phone: (555) 512-8834") == "(555) 512-8834"


def test_extract_phone_still_handles_plain_local_number() -> None:
    assert extract_phone("Phone: 555-512-8834") == "555-512-8834"


def test_header_location_is_found_between_delimited_contact_fields() -> None:
    header = "sofia.reyes.dev@email.com | (555) 512-8834 | Raleigh, NC | linkedin.com/in/sofiareyesdev"

    assert extract_location(header) == "Raleigh, NC"


def test_location_country_inference_handles_common_regions() -> None:
    assert infer_country_from_location("Raleigh, NC") == "US"
    assert infer_country_from_location("Bangalore, IN") == "IN"
    assert infer_country_from_location("Toronto, Ontario") == "CA"
    assert infer_country_from_location("London, UK") == "GB"


def test_domestic_phone_is_formatted_with_location_country_code() -> None:
    assert normalize_phone_with_country("(555) 512-8834", "Raleigh, NC") == "+1 555-512-8834"
    assert normalize_phone_with_country("98765 43210", "Bengaluru, India") == "+91 98765 43210"


def test_phone_inferred_from_resume_body_indicators() -> None:
    assert normalize_phone_with_country(
        "9876543210", location=None, text="Graduated with B.Tech, 14 LPA"
    ) == "+91 98765 43210"


def test_phone_inferred_from_email_domain() -> None:
    assert normalize_phone_with_country(
        "9876543210", location=None, email="john@college.ac.in"
    ) == "+91 98765 43210"


def test_phone_without_country_clues_preserves_raw_value() -> None:
    assert normalize_phone_with_country(
        "9876543210", location=None, text="", email="john@gmail.com"
    ) == "9876543210"


def test_explicit_international_number_is_preserved() -> None:
    assert normalize_phone_with_country("+91 98765 43210", location=None) == "+91 98765 43210"


def test_resume_pipeline_uses_fallback_email_for_country_inference() -> None:
    profile = _profile_from_heuristics("Phone: 9876543210", "candidate@college.ac.in")

    assert profile.personal.phone == "+91 98765 43210"


def test_inbound_body_uses_sender_domain_for_country_inference() -> None:
    inbound = SimpleNamespace(from_name="Candidate", from_email="candidate@college.ac.in")

    _, _, phone, location = _contact_from_email_body(inbound, "Phone: 9876543210", None)

    assert location is None
    assert phone == "+91 98765 43210"


def test_unparseable_phone_is_preserved() -> None:
    assert normalize_phone_with_country("call me at five", "Bangalore") == "call me at five"


def test_heuristic_resume_pipeline_stores_inferred_international_number() -> None:
    profile = _profile_from_heuristics(
        "Sofia Reyes\nsofia.reyes.dev@email.com | (555) 512-8834 | Raleigh, NC",
        "",
    )

    assert profile.personal.phone == "+1 555-512-8834"


def test_is_dummy_phone_number() -> None:
    assert is_dummy_phone_number("+91 1234 567 890") is True
    assert is_dummy_phone_number("1234567890") is True
    assert is_dummy_phone_number("0000000000") is True
    assert is_dummy_phone_number("1111111111") is True
    assert is_dummy_phone_number("+91 98765 43210") is False
    assert is_dummy_phone_number("(555) 512-8834") is False


def test_is_phone_in_text() -> None:
    doc = "Name: John Doe\nEmail: john@example.com\nPhone: +91 98765 43210\nLocation: Bangalore"
    assert is_phone_in_text("+91 98765 43210", doc) is True
    assert is_phone_in_text("9876543210", doc) is True
    assert is_phone_in_text("+91 1234 567 890", doc) is False
    assert is_phone_in_text("555-512-8834", doc) is False

