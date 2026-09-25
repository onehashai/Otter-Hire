import zipfile
from io import BytesIO

import httpx
from PIL import Image

from app.services.avatar_service import (
    _best_docx_headshot,
    _best_legacy_doc_headshot,
    _image_resume_header_crop,
    _linkedin_username,
    _normalise_image,
    _retry_after_seconds,
)
from app.services.resume.hyperlinks import extract_linkedin_url_from_text


def _jpeg(width: int = 240, height: int = 300) -> bytes:
    image = Image.new("RGB", (width, height), "navy")
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def test_docx_embedded_portrait_is_extracted() -> None:
    document = BytesIO()
    with zipfile.ZipFile(document, "w") as archive:
        archive.writestr("word/media/headshot.jpg", _jpeg())

    assert _best_docx_headshot(document.getvalue()) is not None


def test_legacy_doc_embedded_portrait_is_extracted() -> None:
    legacy_document = b"legacy-word-prefix" + _jpeg() + b"legacy-word-suffix"

    assert _best_legacy_doc_headshot(legacy_document) is not None


def test_image_resume_header_crop_and_linkedin_validation() -> None:
    assert _image_resume_header_crop(_jpeg(900, 1200)) is not None
    assert _normalise_image(_jpeg()) is not None
    assert _linkedin_username("https://www.linkedin.com/in/jane-doe/") == "jane-doe"
    assert _linkedin_username("https://example.com/in/jane-doe") is None


def test_plain_text_linkedin_url_is_recovered() -> None:
    assert (
        extract_linkedin_url_from_text("LinkedIn: linkedin.com/in/jane-doe/")
        == "https://linkedin.com/in/jane-doe/"
    )
    assert extract_linkedin_url_from_text("No social profile provided") is None


def test_rate_limit_uses_provider_retry_after_header() -> None:
    assert _retry_after_seconds(httpx.Response(429, headers={"retry-after": "120"})) == 120
