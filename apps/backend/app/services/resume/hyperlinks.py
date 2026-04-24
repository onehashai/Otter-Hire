from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.resume.heuristics import extract_email
from app.services.resume.validation import _sanitize_url


@dataclass
class ResumeHyperlink:
    label: str
    target: str
    source_format: str
    source_hint: str | None = None


def normalize_hyperlink_target(target: str) -> str | None:
    raw = (target or "").strip()
    if not raw:
        return None
    if raw.lower().startswith("mailto:"):
        return raw
    return _sanitize_url(raw)


def classify_hyperlink(target: str) -> tuple[str | None, str | None]:
    normalized = normalize_hyperlink_target(target)
    if not normalized:
        return None, None
    if normalized.lower().startswith("mailto:"):
        email = extract_email(normalized[7:].strip().lower())
        return ("email", email or None)

    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    path = (parsed.path or "").strip("/")
    host_no_www = host[4:] if host.startswith("www.") else host

    if host_no_www in {"linkedin.com"}:
        parts = [p for p in path.split("/") if p]
        if parts and parts[0] in {"in", "pub", "company", "school"} and len(parts) >= 2:
            return ("linkedin", normalized)
        return (None, None)

    if host_no_www == "github.com":
        parts = [p for p in path.split("/") if p]
        if parts and parts[0] not in {
            "features",
            "topics",
            "enterprise",
            "pricing",
            "login",
            "signup",
            "settings",
            "orgs",
            "about",
            "marketplace",
            "explore",
            "search",
            "pulls",
            "issues",
            "notifications",
            "collections",
        }:
            profile_url = f"{parsed.scheme or 'https'}://{parsed.netloc}/{parts[0]}/"
            return ("github", profile_url)
        return (None, None)

    if host_no_www in {
        "bit.ly",
        "tinyurl.com",
        "t.co",
        "lnkd.in",
        "l.facebook.com",
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "youtube.com",
        "youtu.be",
    }:
        return (None, None)

    return ("portfolio", normalized)


def extract_best_links(hyperlinks: list[ResumeHyperlink]) -> tuple[dict[str, str], str | None]:
    profile_links: dict[str, str] = {}
    hyperlink_email: str | None = None

    def portfolio_rank(url: str) -> int:
        host = (urlparse(url).hostname or "").lower()
        host_no_www = host[4:] if host.startswith("www.") else host
        if (
            host_no_www.endswith(".bio")
            or host_no_www.endswith(".me")
            or host_no_www.endswith(".dev")
        ):
            return 3
        if host_no_www in {
            "notion.site",
            "carrd.co",
            "behance.net",
            "dribbble.com",
            "medium.com",
            "substack.com",
            "about.me",
        }:
            return 2
        return 1

    for item in hyperlinks:
        kind, value = classify_hyperlink(item.target)
        if not kind or not value:
            continue
        if kind == "email":
            if value and "@" in value:
                hyperlink_email = value
            continue
        if kind in {"linkedin", "github"}:
            profile_links.setdefault(kind, value)
            continue
        if kind == "portfolio":
            current = profile_links.get("portfolio")
            if current is None or portfolio_rank(value) > portfolio_rank(current):
                profile_links["portfolio"] = value

    return profile_links, hyperlink_email
