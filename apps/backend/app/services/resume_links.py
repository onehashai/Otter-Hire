from __future__ import annotations

import ipaddress
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


@dataclass
class ResumeLinkCandidate:
    raw_url: str
    provider: str
    score: int


_URL_RE = re.compile(
    r"https?://[^\s<>()\"\']+",
    re.IGNORECASE,
)


def _classify_provider(url: str) -> tuple[str, int]:
    """Return (provider, score) for a given URL."""
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    url_lower = url.lower()

    score = 1  # Base score for any valid HTTP/HTTPS link

    if any(token in url_lower for token in ["resume", "cv", "curriculum-vitae", "applicant", "profile"]):
        score += 3
    if path.endswith((".pdf", ".docx", ".doc")):
        score += 3

    if "drive.google.com" in host or "drive.usercontent.google.com" in host:
        return "gdrive", score + 4
    if "docs.google.com" in host:
        return "gdoc", score + 4
    if "dropbox.com" in host:
        return "dropbox", score + 4
    if "onedrive.live.com" in host or "1drv.ms" in host:
        return "onedrive", score + 4
    if ".sharepoint.com" in host:
        return "sharepoint", score + 4

    if path.endswith((".pdf", ".docx", ".doc")):
        return "generic", score + 2

    return "generic", score


def find_resume_links(body_text: str) -> list[ResumeLinkCandidate]:
    """Extract potential resume links from email body text."""
    if not body_text:
        return []

    candidates: list[ResumeLinkCandidate] = []
    seen: set[str] = set()

    for match in _URL_RE.finditer(body_text):
        raw = match.group(0).strip().rstrip(").,;!?\"'>")
        if not raw or raw in seen:
            continue
        seen.add(raw)

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


def normalize_resume_link(url: str, provider: str) -> list[tuple[str, str]]:
    """Return a list of (candidate_download_url, suggested_filename) to try."""
    parsed = urlparse(url)
    path = parsed.path or ""

    # Google Drive file links (handles /file/d/<id>, /d/<id>, ?id=<id>)
    if provider == "gdrive":
        m = re.search(r"/(?:file/d|document/d|d)/([a-zA-Z0-9_-]+)", url) or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
        if m:
            file_id = m.group(1)
            return [
                (f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}", "resume.pdf"),
                (f"https://drive.google.com/uc?id={file_id}&export=download", "resume.pdf"),
                (f"https://drive.usercontent.google.com/download?id={file_id}&export=download", "resume.pdf"),
                (url, "resume.pdf"),
            ]
        return [(url, "resume.pdf")]

    # Google Docs: export as PDF
    if provider == "gdoc":
        m = re.search(r"/(?:document/d|d)/([a-zA-Z0-9_-]+)", url) or re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
        if m:
            doc_id = m.group(1)
            return [
                (f"https://docs.google.com/document/d/{doc_id}/export?format=pdf", "resume.pdf"),
                (url, "resume.pdf"),
            ]
        return [(url, "resume.pdf")]

    # Dropbox: force direct download
    if provider == "dropbox":
        fn = path.rsplit("/", 1)[-1] if "/" in path else "resume.pdf"
        if not fn or "." not in fn:
            fn = "resume.pdf"
        if "dl=0" in url:
            return [(url.replace("dl=0", "dl=1"), fn), (url, fn)]
        if "dl=1" not in url:
            sep = "&" if "?" in url else "?"
            return [(f"{url}{sep}dl=1", fn), (url, fn)]
        return [(url, fn)]

    # OneDrive / SharePoint / Generic
    fn = path.rsplit("/", 1)[-1] if "/" in path else "resume.pdf"
    if not fn or "." not in fn:
        fn = "resume.pdf"
    return [(url, fn)]


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
    if parsed.scheme.lower() not in ("http", "https"):
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
        # On resolution failure, abort
        return None

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,application/msword,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        try:
            resp = await client.get(url)
        except Exception as e:
            logger.warning("Error fetching resume from link %s: %s", url, e)
            return None

        if resp.status_code >= 400:
            logger.warning("Resume link returned HTTP %s for %s", resp.status_code, url)
            return None

        content = resp.content
        if not content or len(content) > max_bytes:
            return None

        content_type = (resp.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()

        # Handle Google Drive confirm page redirect if HTML warning returned
        if "text/html" in content_type and b"uc-download-link" in content:
            m_confirm = re.search(r'href="(/uc\?export=download[^"]+)"', content.decode("utf-8", errors="ignore"))
            if m_confirm:
                confirm_url = "https://drive.google.com" + m_confirm.group(1).replace("&amp;", "&")
                try:
                    resp2 = await client.get(confirm_url)
                    if resp2.status_code < 400 and resp2.content:
                        content = resp2.content
                        content_type = (resp2.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
                except Exception:
                    pass

        # Magic byte detection for content type
        if content.startswith(b"%PDF"):
            content_type = "application/pdf"
        elif content.startswith(b"PK\x03\x04"):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif content.startswith(b"\xd0\xcf\x11\xe0"):
            content_type = "application/msword"

        return content, content_type or "application/pdf"


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

    # Try candidate links
    for candidate in candidates[:3]:
        targets = normalize_resume_link(candidate.raw_url, candidate.provider)
        for download_url, suggested_name in targets:
            result = await download_resume_from_link(download_url, max_bytes=max_bytes, timeout=timeout)
            if not result:
                continue
            content, content_type = result
            # Ensure we got valid file content (PDF or DOCX or DOC or >1KB binary)
            if content.startswith(b"%PDF") or content.startswith(b"PK\x03\x04") or content.startswith(b"\xd0\xcf\x11\xe0") or (len(content) > 500 and "text/html" not in content_type):
                return suggested_name, content_type, content

    return None
