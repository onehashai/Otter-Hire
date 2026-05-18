"""Centralized Sentry SDK initialization.

Import `app.core.logging` (for its import-time `setup_logging()` side effect), then
`import sentry` in both:

  - apps/backend/app/main.py  (FastAPI process)
  - apps/backend/app/temporal/__main__.py  (Temporal worker process)

The module is a no-op when SENTRY_DSN is empty/absent.
"""

from __future__ import annotations

import logging
import re

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# ── patterns that must never appear in any Sentry event ─────────────────────
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
_SENSITIVE_KEYS = frozenset(
    {
        "password",
        "new_password",
        "confirm_password",
        "current_password",
        "access_token",
        "refresh_token",
        "api_key",
        "authorization",
        "cookie",
        "set-cookie",
        "smtp_password",
        "encryption_key",
        "secret_key",
        "webhook_secret",
        "client_secret",
    }
)


def _scrub_value(value: object) -> object:
    """Replace a string value if it looks like a JWT or a known secret."""
    if not isinstance(value, str):
        return value
    if _JWT_RE.search(value):
        return "[Filtered:JWT]"
    return value


def _scrub_dict(d: dict) -> dict:
    """Recursively redact sensitive keys from a dict."""
    result = {}
    for k, v in d.items():
        if str(k).lower() in _SENSITIVE_KEYS:
            result[k] = "[Filtered]"
        elif isinstance(v, dict):
            result[k] = _scrub_dict(v)
        elif isinstance(v, list):
            result[k] = [_scrub_dict(i) if isinstance(i, dict) else _scrub_value(i) for i in v]
        else:
            result[k] = _scrub_value(v)
    return result


def _before_send(event: dict, hint: dict) -> dict | None:
    """Strip PII and secrets before any event is sent to Sentry."""
    # Scrub request headers and cookies (belt-and-suspenders — SDK already
    # omits them when send_default_pii=False, but we want defense-in-depth).
    request = event.get("request") or {}
    if "headers" in request and isinstance(request["headers"], dict):
        request["headers"] = _scrub_dict(request["headers"])
    if "cookies" in request:
        request["cookies"] = "[Filtered]"
    if "data" in request:
        # We set max_request_body_size="never" but scrub as backstop
        request["data"] = "[Filtered]"

    # Scrub extra context that callers may have attached
    if "extra" in event and isinstance(event["extra"], dict):
        event["extra"] = _scrub_dict(event["extra"])

    # Drop events from resume-parsing activities — they may contain parsed text
    transaction = event.get("transaction") or ""
    logger_name = event.get("logger") or ""
    if "resume" in transaction.lower() or "resume" in logger_name.lower():
        # Strip all span/breadcrumb data but keep the error skeleton
        event.pop("breadcrumbs", None)
        spans = event.get("spans") or []
        # Keep op + status only
        event["spans"] = [{"op": s.get("op"), "status": s.get("status")} for s in spans]

    return event


def _before_send_transaction(event: dict, hint: dict) -> dict | None:
    """Drop health-check transactions and strip PII from performance events."""
    request = event.get("request") or {}
    url = request.get("url") or ""
    # Drop noisy health / readiness endpoints entirely
    if any(path in url for path in ("/health", "/docs", "/openapi.json", "/redoc")):
        return None

    # Apply same header scrub to transaction events
    if "headers" in request and isinstance(request["headers"], dict):
        request["headers"] = _scrub_dict(request["headers"])
    if "cookies" in request:
        request["cookies"] = "[Filtered]"

    # Strip S3 span data (presigned URLs contain embedded AWS creds in query params)
    spans = event.get("spans") or []
    clean_spans = []
    for span in spans:
        if span.get("op", "").startswith("db.") or span.get("op", "").startswith("aws."):
            # Keep op, description label, status — drop raw query/URL data
            clean_spans.append(
                {
                    "op": span.get("op"),
                    "description": span.get("description", "")[:200],
                    "status": span.get("status"),
                    "timestamp": span.get("timestamp"),
                    "start_timestamp": span.get("start_timestamp"),
                }
            )
        else:
            clean_spans.append(span)
    event["spans"] = clean_spans

    return event


def init() -> None:
    """Initialize Sentry SDK.  Called once per process at startup."""
    from app.core.config import settings  # imported lazily to avoid circular imports

    if not settings.sentry_dsn:
        logging.getLogger("ats_backend").info("[Sentry] SENTRY_DSN not set — SDK disabled")
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        release=settings.sentry_release,
        integrations=[
            # transaction_style="endpoint" uses the route pattern (e.g. /jobs/{job_id})
            # instead of the raw URL, which prevents cardinality explosion.
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            # Only promote ERROR-level log records to Sentry events — not WARNING.
            LoggingIntegration(level=logging.ERROR, event_level=logging.ERROR),
            HttpxIntegration(),
        ],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        # Never send request bodies — resumes, email content and application
        # data all flow through request bodies.
        max_request_body_size="never",
        # Never auto-attach PII (IP, user email, etc.)
        send_default_pii=False,
        attach_stacktrace=True,
        # Limit background flush time on graceful shutdown
        shutdown_timeout=2,
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
    )

    logging.getLogger("ats_backend").info(
        "[Sentry] SDK initialized env=%s release=%s",
        settings.sentry_environment,
        settings.sentry_release or "unset",
    )


# Auto-initialize on import so a bare `import sentry` at the top of the
# entry-point module is all that is required.
try:
    init()
except Exception as _exc:  # pragma: no cover
    logging.getLogger("ats_backend").warning(
        "[Sentry] Initialization failed (monitoring disabled): %s", _exc
    )
