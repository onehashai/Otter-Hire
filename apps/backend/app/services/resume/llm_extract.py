"""Schema-based LLM extraction (OpenAI JSON) for resume profiles."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.services.resume.canonical import PersonalInfo, ResumeProfile

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"

RESUME_PARSE_LLM_MODEL = "gpt-4o-mini"
RESUME_PARSE_MAX_TEXT_CHARS = 12000
RESUME_PARSE_MAX_TOKENS = 6000

SYSTEM_PROMPT = """You are an expert resume parser for an ATS. Extract structured fields from the resume.

Rules:
- Return JSON only (no markdown fences).
- Use null for unknown fields.
- Do not invent employers, degrees, or dates not supported by the text.
- personal.full_name: The candidate's full name. Resume headers sometimes use letter-spacing
  typography where each character is separated by spaces (e.g. "H A R S H M I S H R A" or
  "H A R S H   M I S H R A"). Reconstruct the proper name by joining the letters and
  identifying word boundaries — use the email address as a hint if available.
  Always return a properly spaced name like "Harsh Mishra", never "HARSHMISHRA" or "H A R S H M I S H R A".
- personal.email and personal.phone must appear in the resume text when set.
- personal.address is city/region/country when clearly stated near the name or header.
- work_experience: most recent first. Include ALL jobs/roles mentioned. Each entry must have:
    company, title, start_date (e.g. "Jan 2018"), end_date ("Present" if current), location, highlights (bullet list).
- education: extract ALL education entries (PhD, Masters, Bachelor, Diploma, 12th, 10th, certificate programs). Each entry must have:
    institution, degree (e.g. "Bachelor of Science", "MBA", "12th Grade", "10th Grade"),
    field (subject/major or null), start_date, end_date,
    grade_value (the actual score/GPA/percentage/marks as a string, e.g. "3.8", "85%", "520/600", "A+"),
    grade_type (one of: "gpa", "percentage", "marks", "grade" — based on what is present; null if none),
    grade_max (denominator or max, e.g. "4.0", "100", "600"; null if not stated).
  IMPORTANT for education:
    - If GPA appears as "GPA: 3.63/4.00" → grade_value="3.63", grade_type="gpa", grade_max="4.0".
    - If percentage appears as "85%" or "85/100" → grade_value="85", grade_type="percentage", grade_max="100".
    - If marks appear as "520/600" → grade_value="520", grade_type="marks", grade_max="600".
    - Do NOT create duplicate entries for the same degree at the same institution. One entry per distinct degree.
- skills: ALL concrete tools/skills (programming languages, frameworks, platforms, soft skills, domain skills).
  Return as array of objects: [{"name": "Python", "category": null}, ...].
- certifications: ALL certifications, licenses, courses with a completion certificate. Each entry:
    name, issuer (certifying body or null), date (completion/expiry date string or null).
- If contact fields (email, phone, name) are already provided in the hints section, use those values directly.
- Add a top-level boolean field "low_confidence": set to true if the resume text is garbled, mostly non-English, or too short to parse reliably; false otherwise.
"""

PERSONALINFO_PROMPT = """You are a contact-info extractor. From the text below extract ONLY:
personal.full_name, personal.email, personal.phone, personal.address.
Return JSON only. Use null for unknown fields."""


@dataclass
class LLMExtractResult:
    profile: ResumeProfile
    low_confidence: bool


def _parse_message_json(content: str) -> dict:
    raw = content.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)
    return json.loads(raw)


def _call_openai(payload: dict) -> dict | None:
    """Execute an OpenAI chat completion call. Returns parsed JSON body or None on error."""
    try:
        with httpx.Client(timeout=httpx.Timeout(120.0)) as client:
            response = client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except Exception as exc:
        logger.warning("resume LLM request failed: %s", exc)
        return None

    if response.status_code >= 400:
        logger.warning(
            "resume LLM HTTP %s: %s",
            response.status_code,
            (response.text or "")[:400],
        )
        return None

    try:
        return response.json()
    except Exception as exc:
        logger.warning("resume LLM response parse failed: %s", exc)
        return None


def extract_resume_profile_llm(text: str, section_hints: str) -> LLMExtractResult | None:
    """Call OpenAI to fill a ResumeProfile.
    Returns LLMExtractResult (profile + low_confidence flag), or None if API unavailable."""
    if not (settings.openai_api_key or "").strip():
        return None

    max_chars = max(2000, RESUME_PARSE_MAX_TEXT_CHARS)
    body_text = text[:max_chars]
    hints = (section_hints or "")[: max_chars // 2]

    user_message = f"""Section hints (may be partial):
{hints}

Resume text:
{body_text}
"""

    payload = {
        "model": RESUME_PARSE_LLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.1,
        "max_tokens": settings.resume_parse_max_tokens,
        "response_format": {"type": "json_object"},
    }

    data = _call_openai(payload)
    if data is None:
        return None

    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("resume LLM unexpected response shape: %s", exc)
        return None

    try:
        parsed = _parse_message_json(raw if isinstance(raw, str) else str(raw))
        if not isinstance(parsed, dict):
            return None
        low_confidence = bool(parsed.pop("low_confidence", False))
        # Normalize skills: LLM sometimes returns ["Python"] instead of [{"name": "Python"}]
        if "skills" in parsed and isinstance(parsed["skills"], list):
            parsed["skills"] = [
                s if isinstance(s, dict) else {"name": str(s)} for s in parsed["skills"] if s
            ]
        # Normalize certifications: LLM sometimes returns plain strings
        if "certifications" in parsed and isinstance(parsed["certifications"], list):
            parsed["certifications"] = [
                c if isinstance(c, dict) else {"name": str(c)}
                for c in parsed["certifications"]
                if c
            ]
        logger.info(
            "resume LLM raw result — skills=%d education=%d work_experience=%d low_confidence=%s",
            len(parsed.get("skills") or []),
            len(parsed.get("education") or []),
            len(parsed.get("work_experience") or []),
            low_confidence,
        )
        profile = ResumeProfile.model_validate(parsed)
        return LLMExtractResult(profile=profile, low_confidence=low_confidence)
    except Exception as exc:
        logger.warning("resume LLM JSON validation failed: %s", exc)
        return None


def extract_personalinfo_llm(text: str) -> PersonalInfo | None:
    """Cheap targeted call (<1000 tokens) to extract only contact fields.
    Used as a confidence-gated fallback when the main extraction is uncertain."""
    if not (settings.openai_api_key or "").strip():
        return None

    body_text = text[:3000]
    payload = {
        "model": RESUME_PARSE_LLM_MODEL,
        "messages": [
            {"role": "system", "content": PERSONALINFO_PROMPT},
            {"role": "user", "content": body_text},
        ],
        "temperature": 0.0,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }

    data = _call_openai(payload)
    if data is None:
        return None

    try:
        raw = data["choices"][0]["message"]["content"]
        parsed = _parse_message_json(raw if isinstance(raw, str) else str(raw))
        personal_data = parsed.get("personal", parsed)
        return PersonalInfo.model_validate(personal_data)
    except Exception as exc:
        logger.warning("personalinfo LLM failed: %s", exc)
        return None
