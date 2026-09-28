from __future__ import annotations

import re
from email.utils import parseaddr
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blocked_domain import BlockedDomain
from app.models.blocked_email_address import BlockedEmailAddress
from app.schemas.validators import EMAIL_ADAPTER

_DOMAIN_PATTERN = re.compile(
    r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)


def normalize_blocked_domain(value: str) -> str:
    """Return a canonical domain or raise ValueError for invalid input."""
    domain = (value or "").strip().lower().lstrip("@")
    if domain.startswith("*."):
        domain = domain[2:]
    domain = domain.rstrip(".")
    try:
        domain = domain.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("Enter a valid email domain") from exc
    if not _DOMAIN_PATTERN.fullmatch(domain):
        raise ValueError("Enter a valid email domain, such as naukri.com")
    return domain


def normalize_blocked_email_address(value: str) -> str:
    """Normalize one mailbox without broadening it to aliases or its domain."""
    try:
        email = str(EMAIL_ADAPTER.validate_python(value.strip())).lower()
    except ValueError as exc:
        raise ValueError("Enter a valid email address, such as sender@example.com") from exc
    if len(email) > 320:
        raise ValueError("Email address is too long")
    return email


def sender_domain_from_email(value: str | None) -> str:
    """Extract a normalized sender domain from an RFC 5322 From value."""
    _, address = parseaddr((value or "").strip())
    candidate = address or (value or "").strip()
    parts = candidate.lower().rsplit("@", 1)
    if len(parts) != 2 or not parts[0]:
        return ""
    try:
        return normalize_blocked_domain(parts[1])
    except ValueError:
        return ""


def domain_is_blocked(sender_domain: str, blocked_domains: list[str] | set[str]) -> bool:
    """Match a domain itself and any of its subdomains against the block list."""
    sender = (sender_domain or "").strip().lower().rstrip(".")
    return any(sender == domain or sender.endswith(f".{domain}") for domain in blocked_domains)


async def get_blocked_sender_domain(
    db: AsyncSession,
    *,
    org_id: UUID,
    sender_email: str | None,
) -> str | None:
    """Return the sender domain when it is blocked for this organization."""
    sender_domain = sender_domain_from_email(sender_email)
    if not sender_domain:
        return None

    result = await db.execute(select(BlockedDomain.domain).where(BlockedDomain.org_id == org_id))
    blocked_domains = {str(domain).lower() for domain in result.scalars().all()}
    return sender_domain if domain_is_blocked(sender_domain, blocked_domains) else None


async def get_blocked_sender_reason(
    db: AsyncSession,
    *,
    org_id: UUID,
    sender_email: str | None,
) -> str | None:
    """Apply the same organization block policy to reception, retries and recovery."""
    domain = await get_blocked_sender_domain(db, org_id=org_id, sender_email=sender_email)
    if domain:
        return f"Sender domain {domain} is in organization blocked list"
    _, address = parseaddr((sender_email or "").strip())
    try:
        email = normalize_blocked_email_address(address)
    except ValueError:
        return None
    result = await db.execute(
        select(BlockedEmailAddress.id)
        .where(
            BlockedEmailAddress.org_id == org_id,
            BlockedEmailAddress.email == email,
        )
        .limit(1)
    )
    if result.scalar_one_or_none() is not None:
        return f"Sender email {email} is in organization blocked list"
    return None
