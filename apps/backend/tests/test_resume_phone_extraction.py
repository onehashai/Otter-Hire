from app.services.resume.heuristics import (
    extract_location,
    extract_phone,
    infer_country_from_location,
    normalize_phone_with_country,
)
from app.services.resume.pipeline import _profile_from_heuristics


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


def test_unparseable_phone_is_preserved() -> None:
    assert normalize_phone_with_country("call me at five", "Bangalore") == "call me at five"


def test_heuristic_resume_pipeline_stores_inferred_international_number() -> None:
    profile = _profile_from_heuristics(
        "Sofia Reyes\nsofia.reyes.dev@email.com | (555) 512-8834 | Raleigh, NC",
        "",
    )

    assert profile.personal.phone == "+1 555-512-8834"
