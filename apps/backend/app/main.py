from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.middleware.context import get_request_context, RequestContext
from app.middleware.errors import http_exception_handler, generic_exception_handler
from app.schemas.common import HealthResponse, RequestContextSchema
from app.api.v1.router import api_router

setup_logging()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="ATS Backend", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


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
