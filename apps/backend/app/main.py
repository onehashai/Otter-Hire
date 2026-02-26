from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded as SlowRateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import make_error_payload
from app.core.logging import logger, setup_logging
from app.middleware.context import RequestContext, get_request_context
from app.middleware.errors import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.schemas.common import HealthResponse, RequestContextSchema

setup_logging()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="ATS Backend", version="1.0.0")
app.state.limiter = limiter

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(SlowRateLimitExceeded)
async def rate_limit_handler(request: Request, exc: SlowRateLimitExceeded):
    payload = make_error_payload(
        status_code=429,
        code="RATE_LIMIT_EXCEEDED",
        message="Too many attempts. Please try again later.",
        request_id=str(getattr(request.state, "request_id", "") or "") or None,
    )
    response = JSONResponse(status_code=429, content=payload.to_response_dict())
    if hasattr(exc, "headers") and isinstance(exc.headers, dict):
        for key, value in exc.headers.items():
            response.headers[key] = value
    return response


@app.on_event("startup")
async def startup_event():
    mode = "production" if settings.is_production else "development"
    logger.info(f"Starting ATS Backend in {mode} mode")


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


@app.get("/me", response_model=RequestContextSchema)
async def get_me(ctx: RequestContext = Depends(get_request_context)):
    return ctx.to_schema()
