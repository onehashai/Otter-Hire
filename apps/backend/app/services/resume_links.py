from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import httpx


@dataclass
class ResumeLinkCandidate:
    raw_url: str
    provider: str
    score: int


_URL_RE = re.compile(
    r"https?://[^\s<>()]+",
    re.IGNORECASE,
)


def _classify_provider(url: str) -> tuple[str, int]:
    """Return (provider, score) for a given URL."""
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()

    # Basic heuristic score: higher means more likely to be an actual resume.
    score = 0
    if any(token in url.lower() for token in ["resume", "cv", "curriculum-vitae"]):
        score += 3
    if path.endswith((".pdf", ".docx", ".doc")):
        score += 2

    if "drive.google.com" in host:
        return "gdrive", score + 3
    if "docs.google.com" in host:
        return "gdoc", score + 3
    if "dropbox.com" in host:
        return "dropbox", score + 3
    if "onedrive.live.com" in host or "1drv.ms" in host:
        return "onedrive", score + 3
    if ".sharepoint.com" in host:
        return "sharepoint", score + 3

    # Generic public link
    if path.endswith((".pdf", ".docx", ".doc")):
        return "generic", score + 1

    return "unknown", score


def find_resume_links(body_text: str) -> list[ResumeLinkCandidate]:
    """Extract potential resume links from email body text."""
    if not body_text:
        return []

    candidates: list[ResumeLinkCandidate] = []
    for match in _URL_RE.finditer(body_text):
        raw = match.group(0).strip().strip(").,;!?\"'")
        if not raw:
            continue
        parsed = urlparse(raw)
        if parsed.scheme.lower() not in ("http", "https"):
            continue
        provider, score = _classify_provider(raw)
        if score <= 0:
            continue
        candidates.append(ResumeLinkCandidate(raw_url=raw, provider=provider, score=score))

    # Sort by score (desc) so we try most likely resume links first
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


def normalize_resume_link(url: str, provider: str) -> tuple[str, str] | None:
    """Return (normalized_download_url, suggested_filename) or None."""
    parsed = urlparse(url)
    path = parsed.path or ""

    # Google Drive file links
    if provider == "gdrive":
        # /file/d/<id>/view
        m = re.search(r"/file/d/([^/]+)/", path)
        if m:
            file_id = m.group(1)
            return (
                f"https://drive.google.com/uc?export=download&id={file_id}",
                "resume.pdf",
            )
        # Fallback: use as-is
        return url, "resume"

    # Google Docs: export as PDF
    if provider == "gdoc":
        m = re.search(r"/document/d/([^/]+)/", path)
        if m:
            doc_id = m.group(1)
            return (
                f"https://docs.google.com/document/d/{doc_id}/export?format=pdf",
                "resume.pdf",
            )
        return url, "resume"

    # Dropbox: force direct download
    if provider == "dropbox":
        if "dl=0" in url:
            return url.replace("dl=0", "dl=1"), path.rsplit("/", 1)[-1] or "resume"
        if "dl=1" not in url:
            sep = "&" if "?" in url else "?"
            return f"{url}{sep}dl=1", path.rsplit("/", 1)[-1] or "resume"
        return url, path.rsplit("/", 1)[-1] or "resume"

    # OneDrive / SharePoint: rely on provider redirects; keep URL as-is
    if provider in {"onedrive", "sharepoint"}:
        return url, path.rsplit("/", 1)[-1] or "resume"

    # Generic: just use as-is
    if provider == "generic":
        return url, path.rsplit("/", 1)[-1] or "resume"

    return None


def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True
    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
        return True
    return False


async def download_resume_from_link(
    url: str,
    max_bytes: int,
    timeout: float,
) -> tuple[bytes, str] | None:
    """Download a resume file from a URL with SSRF and size protections."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https":
        return None

    host = parsed.hostname or ""
    if not host:
        return None

    # Basic SSRF guard: resolve and reject internal IPs
    try:
        import socket

        infos = socket.getaddrinfo(host, None)
        for family, _socktype, _proto, _canonname, sockaddr in infos:
            if family in (socket.AF_INET, socket.AF_INET6):
                ip_str = sockaddr[0]
                if _is_private_ip(ip_str):
                    return None
    except Exception:
        # On resolution failure, be safe and abort
        return None

    headers = {"User-Agent": "onehash-ats-resume-fetcher/1.0"}
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        try:
            head_resp = await client.head(url)
        except Exception:
            head_resp = None

        content_type = ""
        if head_resp is not None and head_resp.headers.get("Content-Type"):
            content_type = head_resp.headers["Content-Type"].split(";", 1)[0].strip()
        if head_resp is not None and head_resp.headers.get("Content-Length"):
            try:
                length = int(head_resp.headers["Content-Length"])
                if length > max_bytes:
                    return None
            except ValueError:
                pass

        try:
            resp = await client.get(url)
        except Exception:
            return None

        if resp.status_code >= 400:
            return None

        data = b""
        for chunk in resp.iter_bytes():
            if chunk:
                data += chunk
            if len(data) > max_bytes:
                return None

        if not content_type and resp.headers.get("Content-Type"):
            content_type = resp.headers["Content-Type"].split(";", 1)[0].strip()

        return data, content_type or "application/octet-stream"


async def resolve_resume_from_body(
    body_text: str,
    max_bytes: int,
    timeout: float,
) -> tuple[str, str, bytes] | None:
    """Find, normalize, and download a resume from links in the body text.

    Returns (filename, content_type, content_bytes) or None.
    """
    candidates = find_resume_links(body_text)
    if not candidates:
        return None

    # Max 2 links per email
    for candidate in candidates[:2]:
        normalized = normalize_resume_link(candidate.raw_url, candidate.provider)
        if not normalized:
            continue
        download_url, suggested_name = normalized
        result = await download_resume_from_link(download_url, max_bytes=max_bytes, timeout=timeout)
        if not result:
            continue
        content, content_type = result
        return suggested_name, content_type, content

    return None

