from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response


def file_not_found_response(request: Request) -> Response:
    """Render a helpful page for browser navigations while keeping API errors JSON."""
    accept = request.headers.get("accept", "").lower()
    if request.headers.get("sec-fetch-mode") == "navigate" or "text/html" in accept:
        return RedirectResponse(
            url="/file-not-found",
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Cache-Control": "no-store"},
        )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
