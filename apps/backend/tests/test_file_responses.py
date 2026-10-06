import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.api.v1.internal.endpoints.file_responses import file_not_found_response


def _request(headers: list[tuple[bytes, bytes]]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/v1/internal/files/local/missing.pdf",
            "headers": headers,
            "query_string": b"",
            "server": ("app.smartats.in", 443),
            "scheme": "https",
            "client": ("127.0.0.1", 1234),
        }
    )


def test_browser_navigation_redirects_to_missing_file_page() -> None:
    response = file_not_found_response(
        _request(
            [
                (b"accept", b"text/html"),
                (b"sec-fetch-mode", b"navigate"),
            ]
        )
    )

    assert response.status_code == 303
    assert response.headers["location"] == "/file-not-found"
    assert response.headers["cache-control"] == "no-store"


def test_non_browser_request_keeps_json_404() -> None:
    with pytest.raises(HTTPException) as exc_info:
        file_not_found_response(_request([(b"accept", b"application/pdf")]))

    assert exc_info.value.status_code == 404
