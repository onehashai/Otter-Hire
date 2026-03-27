"""Lightweight section detection from plain text (header lines + body blocks)."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SectionSegment:
    key: str
    title: str
    body: str


# (compiled pattern, canonical key)
_HEADER_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^\s*(professional\s+)?summary|profile|objective\s*$", re.I), "summary"),
    (re.compile(r"^\s*(work\s+)?experience|employment|work\s+history\s*$", re.I), "experience"),
    (re.compile(r"^\s*education|academic\s+background\s*$", re.I), "education"),
    (re.compile(r"^\s*skills|technical\s+skills|core\s+competencies\s*$", re.I), "skills"),
    (re.compile(r"^\s*projects?\s*$", re.I), "projects"),
    (re.compile(r"^\s*certifications?|licenses?\s*$", re.I), "certifications"),
    (re.compile(r"^\s*awards?|honors?\s*$", re.I), "awards"),
    (re.compile(r"^\s*publications?\s*$", re.I), "publications"),
    (re.compile(r"^\s*languages?\s*$", re.I), "languages"),
    (re.compile(r"^\s*references?\s*$", re.I), "references"),
]


def _classify_header(line: str) -> str | None:
    stripped = line.strip()
    if len(stripped) > 80:
        return None
    for pattern, key in _HEADER_RULES:
        if pattern.match(stripped):
            return key
    return None


def detect_sections(text: str) -> list[SectionSegment]:
    """Split resume text into coarse sections using header-line heuristics."""
    lines = text.splitlines()
    segments: list[SectionSegment] = []
    current_key = "header"
    current_title = "Header"
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf
        body = "\n".join(buf).strip()
        if body:
            segments.append(SectionSegment(key=current_key, title=current_title, body=body))
        buf = []

    for line in lines:
        key = _classify_header(line)
        if key is not None:
            flush()
            current_key = key
            current_title = line.strip()
            buf = []
            continue
        buf.append(line)

    flush()

    # Merge tiny header-only segments into first real block
    if not segments and text.strip():
        return [SectionSegment(key="full", title="Document", body=text.strip())]

    return segments


def sections_to_prompt_hint(segments: list[SectionSegment], max_chars: int = 6000) -> str:
    parts: list[str] = []
    total = 0
    for seg in segments:
        chunk = f"### {seg.title} ({seg.key})\n{seg.body}\n"
        if total + len(chunk) > max_chars:
            remain = max_chars - total
            if remain > 200:
                parts.append(chunk[:remain])
            break
        parts.append(chunk)
        total += len(chunk)
    return "\n".join(parts).strip()
