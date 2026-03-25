"""OpenAI-backed job description generation for the in-app AI Writing Assistant."""

from __future__ import annotations

import re

import httpx

from app.core.config import settings

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
JOB_DESCRIPTION_AI_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """You are an expert recruiting copywriter for an applicant tracking system.
Output only a valid HTML fragment (no <!DOCTYPE>, no <html>/<body> wrapper, no markdown code fences).
Use only these tags: p, br, ul, ol, li, strong, em, u, h2, h3, a (with href).
Write in clear, professional, inclusive language. Do not invent company-specific claims."""


def _strip_wrapping_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines)
    return t.strip()


def _job_context_lines(
    *,
    title: str,
    category: str | None,
    employment_type: str | None,
    workplace_type: str | None,
    country: str | None,
    city: str | None,
) -> str:
    lines = [f"Job title: {title or '(untitled)'}."]
    if category:
        lines.append(f"Category / department: {category}.")
    if employment_type:
        lines.append(f"Employment type: {employment_type}.")
    if workplace_type:
        loc = workplace_type
        if workplace_type in ("hybrid", "onsite") and (city or country):
            loc = f"{workplace_type} ({city or ''} {country or ''}).".replace("  ", " ").strip()
        lines.append(f"Workplace: {loc}.")
    return "\n".join(lines)


def _build_user_message(
    *,
    action: str,
    current_html: str,
    title: str,
    category: str | None,
    employment_type: str | None,
    workplace_type: str | None,
    country: str | None,
    city: str | None,
) -> str:
    ctx = _job_context_lines(
        title=title,
        category=category,
        employment_type=employment_type,
        workplace_type=workplace_type,
        country=country,
        city=city,
    )
    current = (current_html or "").strip() or "(empty)"

    if action == "generate_full":
        return f"""{ctx}

Create a complete job description as HTML. Include:
- An introductory paragraph about the role
- A "Responsibilities" section (h2) with a bullet list
- A "Requirements" section (h2) with a bullet list
- An optional short closing paragraph

Base the content on the job title and context above. If the title is vague, infer a reasonable seniority and stack only when clearly implied by the title."""

    if action == "improve_tone":
        return f"""{ctx}

Current job description (HTML):
{current}

Rewrite the HTML to sound more professional, clear, and inclusive. Preserve structure and meaning; improve wording and flow. Return the full revised HTML fragment."""

    if action == "shorten":
        return f"""{ctx}

Current job description (HTML):
{current}

Shorten the description while keeping the most important responsibilities and requirements. Return HTML only."""

    if action == "expand":
        return f"""{ctx}

Current job description (HTML):
{current}

Expand with more concrete responsibilities and requirements. Do not remove existing content; enrich it. Return HTML only."""

    if action == "add_responsibilities":
        return f"""{ctx}

Current job description (HTML):
{current}

Add or replace a "Responsibilities" section: use an h2 heading "Responsibilities" and a ul list. If such a section already exists, replace its list with a stronger set of bullets. Merge the result into the full HTML document."""

    if action == "add_requirements":
        return f"""{ctx}

Current job description (HTML):
{current}

Add or replace a "Requirements" section: use an h2 heading "Requirements" and a ul list. If such a section already exists, replace its list with a clearer set of bullets. Merge the result into the full HTML document."""

    raise ValueError(f"Unknown action: {action}")


async def run_job_description_ai(
    *,
    action: str,
    current_html: str,
    title: str,
    category: str | None,
    employment_type: str | None,
    workplace_type: str | None,
    country: str | None,
    city: str | None,
) -> str:
    if not (settings.openai_api_key or "").strip():
        raise RuntimeError("OPENAI_API_KEY is not configured")

    user_message = _build_user_message(
        action=action,
        current_html=current_html,
        title=title,
        category=category,
        employment_type=employment_type,
        workplace_type=workplace_type,
        country=country,
        city=city,
    )

    payload = {
        "model": JOB_DESCRIPTION_AI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        response = await client.post(
            OPENAI_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        detail = response.text[:500]
        raise RuntimeError(f"OpenAI API error {response.status_code}: {detail}")

    data = response.json()
    try:
        raw = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError("Unexpected OpenAI response shape") from e

    html = _strip_wrapping_code_fence(raw)
    # If the model returned plain text with newlines only, wrap as paragraph
    if not re.search(r"<[a-zA-Z]", html):
        parts = [p.strip() for p in html.split("\n\n") if p.strip()]
        if parts:
            html = "".join(f"<p>{p}</p>" for p in parts)
    return html
