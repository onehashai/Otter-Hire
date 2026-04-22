"""Regex and heuristic extractors for resume plain text (contact fields + confidence)."""

from __future__ import annotations

import re
from typing import Optional

_NAME_BLOCKLIST = {
    "functional",
    "resume",
    "curriculum vitae",
    "professional profile",
    "professional summary",
    "summary",
    "objective",
    "experience",
    "work experience",
    "employment history",
    "education",
    "skills",
    "certifications",
    "projects",
    "references",
    "profile",
}


def _fallback_email_tokens(fallback_email: Optional[str]) -> set[str]:
    if not fallback_email or "@" not in fallback_email:
        return set()
    local = fallback_email.split("@", 1)[0].lower()
    tokens = re.split(r"[^a-z]+", local)
    return {token for token in tokens if len(token) >= 2}


def score_name_candidate(line: str, *, index: int = 0, fallback_email: Optional[str] = None) -> int:
    email_tokens = _fallback_email_tokens(fallback_email)
    value = re.sub(r"\s+", " ", (line or "")).strip()
    lowered = value.lower()
    if not value or len(value) > 60 or "@" in value:
        return -100
    if lowered in _NAME_BLOCKLIST:
        return -100
    if any(token in lowered for token in _NAME_BLOCKLIST):
        return -25
    if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,60}", value):
        return -100

    parts = [p for p in re.split(r"\s+", value) if p]
    alpha_parts = [p for p in parts if any(ch.isalpha() for ch in p)]
    score = 0

    # Resume names are usually near the top.
    score += max(0, 12 - index)

    # Prefer multi-token person names over single-word headings.
    if len(alpha_parts) >= 2:
        score += 18
    elif len(alpha_parts) == 1:
        score -= 10

    # Reward initials / suffix patterns like "A." or "IV".
    if any(re.fullmatch(r"[A-Za-z]\.", p) for p in alpha_parts):
        score += 4
    if alpha_parts and alpha_parts[-1].upper() in {"JR", "SR", "II", "III", "IV", "V"}:
        score += 4

    # Penalize all-caps single-word headings like FUNCTIONAL.
    if value.isupper() and len(alpha_parts) <= 1:
        score -= 15

    # Prefer candidates that overlap with the email local-part.
    lowered_parts = re.findall(r"[a-z]+", lowered)
    if email_tokens and any(
        part in email_tokens or any(part in token for token in email_tokens)
        for part in lowered_parts
    ):
        score += 10

    return score


def should_replace_name(
    existing_name: Optional[str],
    new_name: Optional[str],
    *,
    fallback_email: Optional[str] = None,
) -> bool:
    if not new_name:
        return False
    if not existing_name:
        return True
    existing_score = score_name_candidate(existing_name, index=0, fallback_email=fallback_email)
    new_score = score_name_candidate(new_name, index=0, fallback_email=fallback_email)
    return new_score > existing_score


def extract_email(text: str) -> Optional[str]:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE)
    if not match:
        return None
    return match.group(0).strip().lower()


def score_phone(value: Optional[str]) -> int:
    if not value:
        return 0
    raw = re.sub(r"\s+", " ", value).strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 10 or len(digits) > 15:
        return 0

    score = 0
    if raw.startswith("+"):
        score += 2
    if "(" in raw and ")" in raw:
        score += 2
    if "-" in raw:
        score += 1
    if len(digits) in {10, 11}:
        score += 2
    if re.match(r"^\d{5}\s+\(", raw):
        score -= 3
    if len(raw) > 24:
        score -= 1
    return score


_E164_PATTERN = re.compile(r"\+[1-9]\d{7,14}")


def extract_phone(text: str) -> Optional[str]:
    # E.164 international numbers take highest priority (+CC followed by 7-14 digits)
    e164_match = _E164_PATTERN.search(text)
    if e164_match:
        candidate = e164_match.group(0)
        digits = re.sub(r"\D", "", candidate)
        if 8 <= len(digits) <= 15:
            return candidate

    candidates = re.finditer(r"(?:\+?\d[\d()\-\s]{8,}\d)", text)
    best: Optional[str] = None
    best_score = -1

    for match in candidates:
        raw = re.sub(r"\s+", " ", match.group(0)).strip()
        raw = re.sub(r"^\d{5}\s+(?=\()", "", raw)
        s = score_phone(raw)
        if s <= 0:
            continue

        if s > best_score:
            best_score = s
            best = raw

    return best


def _clean_location_candidate(raw: str) -> str:
    part = re.split(r"[•|]", raw, maxsplit=1)[0]
    part = re.sub(r"\s+", " ", part).strip(" ,;-")
    return part


def _looks_like_location(value: str) -> bool:
    if len(value) < 4 or len(value) > 60:
        return False
    if any(ch.isdigit() for ch in value):
        return False
    if "," not in value:
        return False
    job_tokens = {
        "intern",
        "engineer",
        "developer",
        "manager",
        "analyst",
        "research",
        "limited",
        "private",
        "technologies",
        "solutions",
        "software",
    }
    lowered = value.lower()
    if any(token in lowered for token in job_tokens):
        return False
    return bool(re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}", value))


def extract_location(text: str) -> Optional[str]:
    blocked_tokens = {
        "bachelor",
        "master",
        "university",
        "college",
        "curriculum",
        "vitae",
        "resume",
        "experience",
        "education",
        "objective",
        "skills",
        "certification",
        "project",
        "linkedin",
        "github",
    }
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:20]:
        if len(line) > 80:
            continue
        lowered = line.lower()
        if any(token in lowered for token in blocked_tokens):
            continue
        if re.search(r"\(\s*\(", line):
            continue
        alpha_count = sum(1 for ch in line if ch.isalpha())
        if alpha_count < 4:
            continue

        candidate = _clean_location_candidate(line)
        if _looks_like_location(candidate):
            return candidate

        if re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}(?:\s+\d{4,6})?", line):
            return line

        symbol_count = sum(1 for ch in line if not (ch.isalnum() or ch.isspace() or ch in ",.-'"))
        if symbol_count > 2:
            continue
        relaxed = _clean_location_candidate(line)
        if _looks_like_location(relaxed):
            return relaxed
    return None


def score_location(value: Optional[str]) -> int:
    if not value:
        return 0
    line = value.strip()
    lowered = line.lower()
    if len(line) < 4 or len(line) > 80:
        return 0

    blocked_tokens = {
        "bachelor",
        "master",
        "university",
        "college",
        "curriculum",
        "vitae",
        "resume",
        "experience",
        "education",
        "objective",
        "skills",
        "certification",
        "project",
    }
    if any(token in lowered for token in blocked_tokens):
        return 0
    if "@" in line:
        return 0

    score = 1
    if "," in line:
        score += 2
    if re.fullmatch(r"[A-Za-z .'-]{2,40},\s*[A-Za-z .'-]{2,40}(?:\s+\d{4,6})?", line):
        score += 3
    if re.search(r"\(\s*\(", line):
        score -= 3
    symbol_count = sum(1 for ch in line if not (ch.isalnum() or ch.isspace() or ch in ",.-'"))
    if symbol_count > 2:
        score -= 2
    return max(score, 0)


def should_replace_location(existing_location: Optional[str], new_location: Optional[str]) -> bool:
    existing_score = score_location(existing_location)
    new_score = score_location(new_location)
    if new_location is None and existing_score <= 1:
        return True
    if not new_location:
        return False
    if not existing_location:
        return True
    return new_score > existing_score


def extract_name(text: str, fallback_email: Optional[str]) -> Optional[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    best_line: Optional[str] = None
    best_score = -100
    for idx, line in enumerate(lines[:12]):
        score = score_name_candidate(line, index=idx, fallback_email=fallback_email)
        if score > best_score:
            best_score = score
            best_line = re.sub(r"\s+", " ", line).strip()
    if best_line and best_score > 0:
        return best_line
    if fallback_email and "@" in fallback_email:
        local = fallback_email.split("@", 1)[0].replace(".", " ").replace("_", " ")
        local = " ".join(part for part in local.split() if part)
        if local:
            return local.title()
    return None


def looks_like_person_name(value: Optional[str]) -> bool:
    if not value:
        return False
    name = value.strip()
    if len(name) < 3 or len(name) > 80:
        return False
    if "@" in name:
        return False
    if re.search(r"\d", name):
        return False
    parts = [p for p in re.split(r"\s+", name) if p]
    return len(parts) >= 2


def resume_confidence_score(
    text: str,
    extracted_name: Optional[str],
    extracted_email: Optional[str],
    extracted_phone: Optional[str],
    extracted_address: Optional[str],
) -> int:
    normalized = re.sub(r"\s+", " ", (text or "")).strip().lower()
    score = 0

    if extracted_email and extracted_email.endswith("@invalid.local") is False:
        score += 2
    if extracted_phone:
        score += 2
    if looks_like_person_name(extracted_name):
        score += 2
    if extracted_address:
        score += 1

    if len(normalized) >= 120:
        score += 2
    elif len(normalized) >= 60:
        score += 1

    resume_keywords = {
        "experience",
        "education",
        "skills",
        "projects",
        "summary",
        "employment",
        "work history",
        "certification",
        "linkedin",
        "github",
    }
    keyword_hits = sum(1 for keyword in resume_keywords if keyword in normalized)
    score += min(keyword_hits, 3)

    return score


def normalize_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None


def should_replace_phone(existing_phone: Optional[str], new_phone: Optional[str]) -> bool:
    if not new_phone:
        return False
    if not existing_phone:
        return True
    return score_phone(new_phone) > score_phone(existing_phone)
