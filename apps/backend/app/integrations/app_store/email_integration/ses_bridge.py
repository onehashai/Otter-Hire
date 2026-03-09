from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr

import boto3
import redis
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.email import InboundEmail
from app.models.organization import OrgInbox

logger = logging.getLogger(__name__)

_PROCESS_KEY_TIMEOUT_SECONDS = 30
_REDIS_SOCKET_TIMEOUT_SECONDS = 2


def _extract_recipient(to_values: list[str]) -> str | None:
    joined = ", ".join(to_values or [])
    emails = re.findall(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", joined)
    if not emails:
        return None
    return emails[0].strip().lower()


def _extract_text_and_attachments(raw_email: bytes) -> dict:
    msg = BytesParser(policy=policy.default).parsebytes(raw_email)
    to_values = msg.get_all("To", [])
    from_value = msg.get("From") or ""
    _, from_email = parseaddr(from_value)

    text_body = ""
    html_body = ""
    attachments: list[dict] = []

    for part in msg.walk():
        content_type = part.get_content_type()
        disposition = part.get_content_disposition()
        if disposition == "attachment":
            blob = part.get_payload(decode=True) or b""
            attachments.append(
                {
                    "filename": part.get_filename() or "attachment.bin",
                    "content_type": content_type,
                    "content_base64": base64.b64encode(blob).decode("ascii"),
                }
            )
        elif content_type == "text/plain" and not text_body:
            text_body = (part.get_payload(decode=True) or b"").decode(
                part.get_content_charset() or "utf-8", errors="ignore"
            )
        elif content_type == "text/html" and not html_body:
            html_body = (part.get_payload(decode=True) or b"").decode(
                part.get_content_charset() or "utf-8", errors="ignore"
            )

    message_id = (msg.get("Message-ID") or "").strip().strip("<>")
    if not message_id:
        message_id = hashlib.sha256(raw_email).hexdigest()[:32]

    return {
        "inbox_address": _extract_recipient(to_values),
        "from_email": (from_email or "").strip().lower() or None,
        "subject": (msg.get("Subject") or "").strip() or None,
        "message_id": message_id,
        "text_body": text_body,
        "html_body": html_body,
        "attachments": attachments,
    }


_ENQUEUED_TTL_SECONDS = 86400  # 24h - avoid re-enqueuing same key while workflow runs


def _is_key_enqueued_in_redis(raw_key: str) -> bool:
    """Check if key was recently enqueued (workflow may still be running)."""
    try:
        r = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
        )
        return bool(r.exists(f"inbound:enqueued:{raw_key}"))
    except Exception:
        logger.exception("SES bridge redis exists failed key=%s", raw_key)
        return False


def _mark_key_enqueued_in_redis(raw_key: str) -> None:
    """Mark key as enqueued to avoid SES bridge re-enqueuing every poll cycle."""
    try:
        r = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=_REDIS_SOCKET_TIMEOUT_SECONDS,
        )
        r.setex(f"inbound:enqueued:{raw_key}", _ENQUEUED_TTL_SECONDS, "1")
    except Exception:
        logger.exception("SES bridge redis setex failed key=%s", raw_key)


async def _is_key_already_processed(raw_key: str) -> bool:
    logger.info("SES bridge dedupe check start key=%s", raw_key)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InboundEmail.id).where(InboundEmail.raw_storage_key == raw_key).limit(1)
        )
        found = result.scalar_one_or_none() is not None
        logger.info("SES bridge dedupe db key=%s found=%s", raw_key, found)
        return found


async def _find_inbox_secret(inbox_address: str) -> str | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(OrgInbox).where(OrgInbox.inbox_address == inbox_address))
        inbox = result.scalar_one_or_none()
        if inbox is None:
            return None
        return inbox.secret_hash or settings.inbound_webhook_secret


def _extract_org_id_from_forwarding_address(inbox_address: str) -> str | None:
    """
    Parse forwarding alias format:
    org-<32hex>@inbound.domain -> UUID string with dashes
    """
    value = (inbox_address or "").strip().lower()
    match = re.match(r"^org-([0-9a-f]{32})@", value)
    if not match:
        return None
    hex_id = match.group(1)
    return f"{hex_id[0:8]}-{hex_id[8:12]}-{hex_id[12:16]}-{hex_id[16:20]}-{hex_id[20:32]}"


async def _resolve_inbox_context(inbox_address: str) -> tuple[str, str] | None:
    """
    Resolve secret + canonical inbox address.
    1) Direct match on org_inboxes.inbox_address
    2) Fallback for forwarding alias org-<orgid>@inbound.domain -> lookup by org_id
    """
    async with AsyncSessionLocal() as db:
        direct_result = await db.execute(
            select(OrgInbox).where(OrgInbox.inbox_address == inbox_address)
        )
        direct_inbox = direct_result.scalar_one_or_none()
        if direct_inbox is not None:
            secret = direct_inbox.secret_hash or settings.inbound_webhook_secret
            if secret:
                return secret, direct_inbox.inbox_address

        org_id = _extract_org_id_from_forwarding_address(inbox_address)
        if not org_id:
            return None

        org_result = await db.execute(select(OrgInbox).where(OrgInbox.org_id == org_id))
        org_inbox = org_result.scalar_one_or_none()
        if org_inbox is None:
            return None
        secret = org_inbox.secret_hash or settings.inbound_webhook_secret
        if not secret:
            return None
        return secret, org_inbox.inbox_address


async def _cleanup_ignored_inbound_records(s3_client, bucket: str) -> None:
    if not settings.inbound_ignored_cleanup_enabled:
        return
    retention_days = max(1, int(settings.inbound_ignored_retention_days))
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InboundEmail.id, InboundEmail.raw_storage_key).where(
                InboundEmail.parse_status == "ignored",
                InboundEmail.created_at < cutoff,
            )
        )
        rows = result.all()
        if not rows:
            return

        ids = [row[0] for row in rows]
        raw_keys = [str(row[1]).strip() for row in rows if row[1]]

        for key in raw_keys:
            try:
                s3_client.delete_object(Bucket=bucket, Key=key)
            except Exception:
                logger.exception("SES bridge cleanup failed to delete raw key=%s", key)

        await db.execute(delete(InboundEmail).where(InboundEmail.id.in_(ids)))
        await db.commit()
        logger.info(
            "SES bridge cleanup removed ignored_rows=%s raw_objects_attempted=%s cutoff=%s",
            len(ids),
            len(raw_keys),
            cutoff.isoformat(),
        )


def _post_to_inbound_api(payload: dict, secret: str) -> tuple[int, str]:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        f"{settings.inbound_internal_api_base_url.rstrip('/')}/public/inbound/email",
        data=body,
        headers={"Content-Type": "application/json", "X-OneHash-Signature": signature},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="ignore")


def _enqueue_raw_key_via_http(bucket: str, key: str) -> tuple[int, str]:
    body = json.dumps({"bucket": bucket, "key": key}, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        f"{settings.inbound_internal_api_base_url.rstrip('/')}/public/inbound/s3-event",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="ignore")


async def _process_raw_key(s3_client, bucket: str, key: str) -> None:
    logger.info("SES bridge process start key=%s", key)
    if "AMAZON_SES_SETUP_NOTIFICATION" in key:
        logger.info("SES bridge skipped key=%s reason=ses_setup_notification", key)
        return
    if await _is_key_already_processed(key):
        logger.info("SES bridge skipped key=%s reason=already_processed", key)
        return
    if settings.inbound_async_pipeline_enabled and settings.inbound_async_enqueue_via_http:
        status, response_text = await asyncio.to_thread(_enqueue_raw_key_via_http, bucket, key)
        if status >= 400:
            logger.error(
                "SES bridge enqueue failed key=%s status=%s body=%s",
                key,
                status,
                response_text,
            )
            return
        _mark_key_enqueued_in_redis(key)
        logger.info("SES bridge enqueued key=%s status=%s", key, status)
        return

    logger.info("SES bridge processing key=%s bucket=%s", key, bucket)
    logger.info("SES bridge s3 fetch start key=%s", key)
    raw_email = await asyncio.to_thread(
        lambda: s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
    )
    logger.info("SES bridge s3 fetch done key=%s bytes=%s", key, len(raw_email))
    logger.info("SES bridge parse start key=%s", key)
    normalized = _extract_text_and_attachments(raw_email)
    logger.info("SES bridge parse done key=%s inbox=%s", key, normalized.get("inbox_address"))
    inbox_address = normalized.get("inbox_address")
    if not inbox_address:
        logger.warning("SES bridge skipped key=%s reason=missing_recipient", key)
        return

    inbox_context = await _resolve_inbox_context(inbox_address)
    if not inbox_context:
        logger.warning(
            "SES bridge skipped key=%s inbox=%s reason=inbox_or_secret_not_found",
            key,
            inbox_address,
        )
        return
    secret, canonical_inbox_address = inbox_context

    payload = {
        "inbox_address": canonical_inbox_address,
        "from_email": normalized.get("from_email"),
        "subject": normalized.get("subject"),
        "message_id": normalized.get("message_id"),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "raw_storage_key": key,
        "text_body": normalized.get("text_body") or None,
        "html_body": normalized.get("html_body") or None,
        "attachments": normalized.get("attachments") or [],
    }

    status, response_text = await asyncio.to_thread(_post_to_inbound_api, payload, secret)
    if status >= 400:
        logger.error(
            "SES bridge post failed key=%s inbox=%s status=%s body=%s",
            key,
            inbox_address,
            status,
            response_text,
        )
        return

    logger.info(
        "SES bridge processed key=%s inbox=%s canonical_inbox=%s status=%s",
        key,
        inbox_address,
        canonical_inbox_address,
        status,
    )


async def run_ses_raw_bridge_loop(stop_event: asyncio.Event) -> None:
    if not settings.s3_enabled:
        logger.info("SES bridge disabled because S3 is not enabled")
        return
    bucket = settings.effective_ses_raw_bridge_bucket
    prefix = settings.effective_ses_raw_bridge_prefix
    if not bucket:
        logger.warning("SES bridge disabled because bucket is missing")
        return

    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_s3_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    logger.info("SES bridge started bucket=%s prefix=%s", bucket, prefix)
    last_cleanup_epoch = 0.0
    max_parallel = 10
    while not stop_event.is_set():
        try:
            # Paginate across all available objects so new keys are not skipped when
            # the prefix grows beyond a single list_objects_v2 page.
            keys_with_mtime: list[tuple[str, datetime | None]] = []
            continuation_token: str | None = None
            while True:
                request = {
                    "Bucket": bucket,
                    "Prefix": prefix,
                    "MaxKeys": max(1, settings.ses_raw_bridge_max_keys),
                }
                if continuation_token:
                    request["ContinuationToken"] = continuation_token
                response = s3_client.list_objects_v2(**request)
                keys_with_mtime.extend(
                    (obj["Key"], obj.get("LastModified")) for obj in response.get("Contents", [])
                )
                if not response.get("IsTruncated"):
                    break
                continuation_token = response.get("NextContinuationToken")
                if not continuation_token:
                    break

            # Prioritize latest raw emails first for lower end-to-end latency.
            keys_with_mtime.sort(
                key=lambda item: item[1] or datetime.fromtimestamp(0, tz=timezone.utc),
                reverse=True,
            )

            if keys_with_mtime:
                newest_seen = keys_with_mtime[0][1]
                keys_with_mtime = keys_with_mtime[: max(1, settings.ses_raw_bridge_max_keys)]
                logger.info(
                    "SES bridge scan bucket=%s prefix=%s keys=%s newest=%s processing=%s",
                    bucket,
                    prefix,
                    len(keys_with_mtime),
                    newest_seen.isoformat() if newest_seen else None,
                    len(keys_with_mtime),
                )

            semaphore = asyncio.Semaphore(max_parallel)

            async def _process_with_limit(raw_key: str) -> None:
                async with semaphore:
                    started = time.monotonic()
                    try:
                        await asyncio.wait_for(
                            _process_raw_key(s3_client, bucket, raw_key),
                            timeout=_PROCESS_KEY_TIMEOUT_SECONDS,
                        )
                        logger.info(
                            "SES bridge finished key=%s duration_ms=%s",
                            raw_key,
                            int((time.monotonic() - started) * 1000),
                        )
                    except asyncio.TimeoutError:
                        logger.error(
                            "SES bridge timed out key=%s timeout_seconds=%s",
                            raw_key,
                            _PROCESS_KEY_TIMEOUT_SECONDS,
                        )
                    except Exception:
                        logger.exception("SES bridge failed key=%s", raw_key)

            tasks: list[asyncio.Task[None]] = []
            for key, _ in keys_with_mtime:
                if stop_event.is_set():
                    break
                tasks.append(asyncio.create_task(_process_with_limit(key)))

            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

            now = time.monotonic()
            if now - last_cleanup_epoch >= max(
                60, int(settings.inbound_ignored_cleanup_interval_seconds)
            ):
                await _cleanup_ignored_inbound_records(s3_client, bucket)
                last_cleanup_epoch = now
        except Exception:
            logger.exception("SES bridge loop error")
        try:
            await asyncio.wait_for(
                stop_event.wait(), timeout=max(5, settings.ses_raw_bridge_poll_seconds)
            )
        except asyncio.TimeoutError:
            pass

    logger.info("SES bridge stopped")
