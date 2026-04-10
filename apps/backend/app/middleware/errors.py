import sentry_sdk
from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.errors import make_error_payload
from app.core.logging import logger


async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = str(getattr(request.state, "request_id", "") or "")
    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "HTTP_ERROR"))
        message = str(detail.get("message", "Request failed"))
        details = detail.get("details")
    else:
        code = "HTTP_ERROR"
        message = str(detail) if detail else "Request failed"
        details = None

    # Capture server-side HTTP errors (5xx) to Sentry.
    # 4xx errors are expected application behavior and are not captured.
    if exc.status_code >= 500:
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("error_code", code)
            scope.set_tag("http_status", exc.status_code)
            sentry_sdk.capture_exception(exc)

    payload = make_error_payload(
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
        request_id=request_id or None,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=payload.to_response_dict(),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = str(getattr(request.state, "request_id", "") or "")
    payload = make_error_payload(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        message="Validation failed",
        details=exc.errors(),
        request_id=request_id or None,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=payload.to_response_dict(),
    )


async def generic_exception_handler(request: Request, exc: Exception):
    request_id = str(getattr(request.state, "request_id", "") or "")
    logger.error(f"Unhandled exception request_id={request_id}: {exc}", exc_info=True)

    # FastAPI's custom exception handlers intercept exceptions before the
    # Sentry ASGI middleware sees them, so we must capture manually here.
    sentry_sdk.capture_exception(exc)

    payload = make_error_payload(
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message="Internal server error",
        request_id=request_id or None,
    )
    return JSONResponse(
        status_code=500,
        content=payload.to_response_dict(),
    )
