from __future__ import annotations

import csv
import io
import re
from collections.abc import AsyncIterator, Iterable
from typing import Any

from app.schemas.canonical import CanonicalCandidate

HEADER_ALIASES = {
    "email": {"email", "e-mail", "email address", "e_mail"},
    "phone": {"phone", "mobile", "mobile number", "telephone"},
    "full_name": {"full name", "name", "candidate name"},
    "first_name": {"first name", "firstname", "given name"},
    "last_name": {"last name", "lastname", "surname", "family name"},
    "skills": {"skills", "skill", "technical skills"},
    "resume_text": {"resume", "resume text", "cv", "cv text"},
}


def normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower().replace("_", " "))


def detect_headers(headers: Iterable[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for header in headers:
        normalized = normalize_header(header)
        for canonical, aliases in HEADER_ALIASES.items():
            if normalized in aliases:
                mapping[canonical] = header
                break
    return mapping


def row_to_candidate(row: dict[str, Any], mapping: dict[str, str]) -> CanonicalCandidate:
    def value(key: str) -> str | None:
        raw = row.get(mapping.get(key, "")) if mapping.get(key) else None
        return str(raw).strip() if raw not in (None, "") else None

    full_name = value("full_name") or ""
    parts = full_name.split(None, 1)
    return CanonicalCandidate(
        first_name=value("first_name") or (parts[0] if parts else ""),
        last_name=value("last_name") or (parts[1] if len(parts) > 1 else ""),
        email=value("email"), phone=value("phone"), skills=value("skills") or [],
        resume_text=value("resume_text"),
    )


def parse_csv(content: bytes) -> tuple[dict[str, str], list[CanonicalCandidate], list[dict[str, Any]]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    mapping = detect_headers(reader.fieldnames or [])
    rows: list[CanonicalCandidate] = []
    errors: list[dict[str, Any]] = []
    for number, raw in enumerate(reader, start=2):
        try:
            rows.append(row_to_candidate(raw, mapping))
        except Exception as exc:
            errors.append({"row": number, "message": str(exc)})
    return mapping, rows, errors


async def stream_candidates(db: Any, org_id: Any) -> AsyncIterator[bytes]:
    from sqlalchemy import select

    from app.models.candidate import Candidate
    result = await db.stream_scalars(select(Candidate).where(Candidate.org_id == org_id).order_by(Candidate.created_at.desc()))
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["First Name", "Last Name", "E-Mail", "Phone", "Skills", "Resume Text"])
    yield output.getvalue().encode()
    async for candidate in result:
        first, _, last = candidate.name.partition(" ")
        output.seek(0)
        output.truncate(0)
        writer.writerow([first, last, candidate.email, candidate.phone or "", "; ".join(candidate.tags or []), (candidate.parsed_resume or {}).get("resume_text", "")])
        yield output.getvalue().encode()
