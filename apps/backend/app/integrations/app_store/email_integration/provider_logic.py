from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import dns.exception
import dns.resolver

EMAIL_PROVIDERS = {"google", "microsoft", "zoho"}
VERIFICATION_MODES = {"link", "code", "none"}
PUBLIC_DOMAIN_PROVIDER_MAP = {
    "gmail.com": ("google", "domain_map", "high", "personal"),
    "googlemail.com": ("google", "domain_map", "high", "personal"),
    "outlook.com": ("microsoft", "domain_map", "high", "personal"),
    "hotmail.com": ("microsoft", "domain_map", "high", "personal"),
    "live.com": ("microsoft", "domain_map", "high", "personal"),
    "msn.com": ("microsoft", "domain_map", "high", "personal"),
    "zoho.com": ("zoho", "domain_map", "high", "personal"),
    "zohomail.com": ("zoho", "domain_map", "high", "personal"),
    "zeptomail.com": ("zoho", "domain_map", "high", "personal"),
}


def normalize_provider_key(value: str | None) -> str:
    provider = (value or "").strip().lower()
    if provider in EMAIL_PROVIDERS:
        return provider
    return ""


def email_domain(value: str | None) -> str:
    parts = (value or "").strip().lower().rsplit("@", 1)
    return parts[1] if len(parts) == 2 else ""


def _lookup_mx_hosts(domain: str) -> list[str]:
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=4.0)
    except (
        dns.resolver.NoAnswer,
        dns.resolver.NXDOMAIN,
        dns.resolver.NoNameservers,
        dns.exception.Timeout,
        ValueError,
    ):
        return []
    hosts: list[str] = []
    for answer in sorted(answers, key=lambda item: getattr(item, "preference", 0)):
        exchange = str(getattr(answer, "exchange", "") or "").strip().rstrip(".").lower()
        if exchange:
            hosts.append(exchange)
    return hosts


def _provider_from_mx_hosts(mx_hosts: list[str]) -> tuple[str, str] | None:
    for host in mx_hosts:
        if host.endswith("google.com") or host.endswith("googlemail.com"):
            return ("google", "workspace")
        if host.endswith("mail.protection.outlook.com") or host.endswith("outlook.com"):
            return ("microsoft", "workspace")
        if "zoho" in host or "zeptomail" in host:
            return ("zoho", "workspace")
    return None


def detect_provider(mailbox_email: str | None) -> dict[str, str]:
    domain = email_domain(mailbox_email)
    if not domain:
        return {
            "provider_key": "",
            "provider": "",
            "detection_source": "invalid_email",
            "detection_confidence": "low",
            "mailbox_type": "unknown",
        }
    mapped = PUBLIC_DOMAIN_PROVIDER_MAP.get(domain)
    if mapped:
        provider_key, source, confidence, mailbox_type = mapped
        return {
            "provider_key": provider_key,
            "provider": provider_key,
            "detection_source": source,
            "detection_confidence": confidence,
            "mailbox_type": mailbox_type,
        }

    mx_hosts = _lookup_mx_hosts(domain)
    mx_detection = _provider_from_mx_hosts(mx_hosts)
    if mx_detection:
        provider_key, mailbox_type = mx_detection
        return {
            "provider_key": provider_key,
            "provider": provider_key,
            "detection_source": "mx_lookup",
            "detection_confidence": "medium",
            "mailbox_type": mailbox_type,
        }
    return {
        "provider_key": "",
        "provider": "",
        "detection_source": "mx_lookup",
        "detection_confidence": "low",
        "mailbox_type": "unknown",
    }


def resolve_expected_verification_mode(provider_key: str, mailbox_email: str | None) -> str:
    provider = normalize_provider_key(provider_key)
    domain = email_domain(mailbox_email)
    if provider == "google":
        return "link" if domain == "gmail.com" else "none"
    if provider == "zoho":
        return "code"
    return "none"


def build_verification_state(
    mailbox_email: str | None,
    *,
    preserve_secret: str | None = None,
) -> dict:
    detection = detect_provider(mailbox_email)
    provider_key = detection["provider_key"]
    expected_mode = resolve_expected_verification_mode(provider_key, mailbox_email)
    cfg = {
        "provider_key": provider_key,
        "provider": provider_key,
        "inbound_address": (mailbox_email or "").strip().lower() or None,
        "mailbox_email": (mailbox_email or "").strip().lower() or None,
        "verification_started_at": datetime.now(timezone.utc).isoformat(),
        "provider_detection_source": detection["detection_source"],
        "provider_detection_confidence": detection["detection_confidence"],
        "mailbox_type": detection["mailbox_type"],
        "expected_verification_mode": expected_mode,
        "active_verification_mode": expected_mode,
        "verification_status": "pending",
        "verification_confirmed_via": None,
        "verification_action_type": None,
        "verification_provider": None,
        "verification_email_id": None,
        "verification_code_hash": None,
        "verification_code_expires_at": None,
        "verified_at": None,
    }
    if preserve_secret:
        cfg["secret_hash"] = preserve_secret
    return cfg


def hash_verification_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def code_expiry_iso(hours: int = 24) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
