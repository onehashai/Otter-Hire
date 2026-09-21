"""Safe normalization helpers for communication history copied from source ATSs."""

from __future__ import annotations

import html
import re
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

_HTML_TAG_PATTERN = re.compile(r"</?[a-zA-Z][^>]*>")
_ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}
_VOID_TAGS = {"br", "hr"}
_BLOCK_TAGS = {
    "blockquote",
    "br",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "p",
    "pre",
    "tr",
}
_DROP_CONTENT_TAGS = {"script", "style", "iframe", "object", "embed", "svg", "math"}


class _SafeMessageHtmlParser(HTMLParser):
    """Rebuild only harmless HTML instead of trying to remove unsafe fragments."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.html_parts: list[str] = []
        self.text_parts: list[str] = []
        self._dropped_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self._dropped_depth += 1
            return
        if self._dropped_depth:
            return
        if tag not in _ALLOWED_TAGS:
            return
        if tag in _BLOCK_TAGS:
            self.text_parts.append("\n")
        if tag == "a":
            href = next((value for key, value in attrs if key.lower() == "href"), None)
            if href and _is_safe_link(href):
                self.html_parts.append(f'<a href="{html.escape(href, quote=True)}" rel="noreferrer">')
            else:
                self.html_parts.append("<a>")
            return
        self.html_parts.append(f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in _DROP_CONTENT_TAGS:
            self._dropped_depth = max(0, self._dropped_depth - 1)
            return
        if self._dropped_depth or tag not in _ALLOWED_TAGS:
            return
        if tag in _BLOCK_TAGS:
            self.text_parts.append("\n")
        if tag not in _VOID_TAGS:
            self.html_parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self._dropped_depth:
            return
        self.html_parts.append(html.escape(data))
        self.text_parts.append(data)


def _is_safe_link(value: str) -> bool:
    parsed = urlparse(value.strip())
    return not parsed.scheme or parsed.scheme.lower() in {"http", "https", "mailto"}


def sanitize_imported_message_content(
    body: Any, html_body: Any = None
) -> tuple[str, str | None]:
    """Return plain text plus an XSS-safe optional HTML representation.

    The normal message preview only uses the plain text. The sanitized HTML is
    retained for the full-message dialog so provider formatting remains useful.
    """
    html_value = str(html_body or "").strip()
    body_value = str(body or "").strip()
    raw_html = html_value or (body_value if _HTML_TAG_PATTERN.search(body_value) else "")
    if not raw_html:
        return html.unescape(body_value), None

    parser = _SafeMessageHtmlParser()
    try:
        parser.feed(raw_html)
        parser.close()
    except Exception:
        # The parser already escapes every emitted text node. Fall back to text
        # only if a malformed payload prevents it completing.
        return html.unescape(body_value), None
    plain = "\n".join(
        line.strip() for line in "".join(parser.text_parts).splitlines() if line.strip()
    )
    return plain or html.unescape(body_value), "".join(parser.html_parts) or None


def parse_imported_message_timestamp(value: Any) -> datetime:
    """Normalize ISO-8601 and provider Unix timestamps to an aware UTC datetime."""
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)):
        seconds = float(value) / 1000 if abs(value) >= 100_000_000_000 else float(value)
        parsed = datetime.fromtimestamp(seconds, tz=UTC)
    else:
        raw = str(value or "").strip()
        if raw.isdecimal():
            seconds = int(raw) / 1000 if len(raw) >= 12 else int(raw)
            parsed = datetime.fromtimestamp(seconds, tz=UTC)
        else:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def normalized_message_direction(value: Any, from_email: str, candidate_email: str) -> str:
    direction = str(value or "").strip().lower()
    if direction in {"inbound", "incoming", "received", "candidate"}:
        return "inbound"
    if direction in {"outbound", "outgoing", "sent", "recruiter", "user"}:
        return "outbound"
    if from_email and candidate_email and from_email.casefold() == candidate_email.casefold():
        return "inbound"
    return "outbound"
