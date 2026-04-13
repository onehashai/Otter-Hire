"""Schema-based LLM extraction (OpenAI JSON) for resume profiles."""

from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings
from app.services.resume.canonical import ResumeProfile

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"

RESUME_PARSE_LLM_MODEL = "gpt-4o-mini"
RESUME_PARSE_MAX_TEXT_CHARS = 12000

SYSTEM_PROMPT = """You are an expert resume parser for an ATS. Extract structured fields from the resume.
Rules:
- Return JSON only (no markdown fences).
- Use null for unknown fields.
- Do not invent employers, degrees, or dates not supported by the text.
- personal.email and personal.phone must appear in the resume text when set.
- personal.address is city/region/country when clearly stated near the name or header.
- work_experience: most recent first when possible.
- highlights: bullet-level achievements only (short strings).
- skills: concrete tools/skills (programming languages, frameworks, products).
"""


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


def extract_resume_profile_llm(text: str, section_hints: str) -> ResumeProfile | None:
    """Call OpenAI to fill a ResumeProfile. Returns None if API unavailable or parse fails."""
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
        "max_tokens": 4096,
        "response_format": {"type": "json_object"},
    }

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
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("resume LLM unexpected response shape: %s", exc)
        return None

    try:
        parsed = _parse_message_json(raw if isinstance(raw, str) else str(raw))
        if not isinstance(parsed, dict):
            return None
        return ResumeProfile.model_validate(parsed)
    except Exception as exc:
        logger.warning("resume LLM JSON validation failed: %s", exc)
        return None
