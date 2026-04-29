from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.core.redis_client import get_redis_client
from app.services.esco_loader import lookup_esco
from app.services.resume.canonical import ResumeProfile

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
JD_PARSE_MODEL = "gpt-4o-mini"
SCORING_MODEL = "gpt-4o-mini"
JD_PARSE_CACHE_PREFIX = "ats:jd-parse:v1:"
JD_PARSE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
SCORING_CACHE_PREFIX = "ats:resume-score:v2:"
SCORING_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
EXP_RELEVANCE_CACHE_PREFIX = "ats:exp-relevance:v1:"
EXP_RELEVANCE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30

_NORMALIZE_RE = re.compile(r"[^a-z0-9\s+/().,-]+")
_SPACE_RE = re.compile(r"\s+")
_YEARS_RE = re.compile(r"(\d+)(?:\+|\s*-\s*\d+)?\s+years?", re.IGNORECASE)

_STOPWORDS = {"a", "an", "and", "for", "in", "of", "the", "to", "with"}
_MIN_SKILL_LENGTH = 2
_MAX_SKILL_WORDS = 4
_SOFT_SKILL_TERMS = {
    "communication",
    "leadership",
    "teamwork",
    "collaboration",
    "problem solving",
    "organizational skills",
    "stakeholder management",
}
_VERBS = {
    "analyze",
    "build",
    "built",
    "collaborate",
    "create",
    "created",
    "debug",
    "debugging",
    "deliver",
    "delivered",
    "deploy",
    "deployed",
    "design",
    "designed",
    "develop",
    "developed",
    "drive",
    "driven",
    "execute",
    "executed",
    "improve",
    "improved",
    "implement",
    "implemented",
    "lead",
    "led",
    "maintain",
    "managed",
    "optimize",
    "optimized",
    "support",
    "supported",
    "work",
    "worked",
}
_GENERIC_SKILL_WORDS = {
    "ability",
    "experience",
    "knowledge",
    "understanding",
    "working",
}
# ---------------------------------------------------------------------------
# Skill normalization — ESCO + Embeddings (no hardcoded aliases)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Skill semantic match cache
# ---------------------------------------------------------------------------
SKILL_SEMANTIC_CACHE_PREFIX = "ats:skill-semantic:v1:"
SKILL_SEMANTIC_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


async def _llm_semantic_skill_match(
    unmatched_jd_skills: list[str],
    resume_skills: list[str],
) -> dict[str, str]:
    """One LLM call for ALL unmatched skills at once.
    Returns {jd_skill: resume_skill} for confirmed semantic matches.
    Cached 30 days. Returns {} on any failure.
    """
    if not unmatched_jd_skills or not resume_skills:
        return {}
    if not (settings.openai_api_key or "").strip():
        return {}

    cache_payload = json.dumps(
        {"jd": sorted(unmatched_jd_skills), "resume": sorted(resume_skills)},
        sort_keys=True,
        ensure_ascii=True,
    )
    cache_key = f"{SKILL_SEMANTIC_CACHE_PREFIX}{_safe_sha256(cache_payload)}"
    cached = await _redis_get_json(cache_key)
    if cached is not None:
        return cached

    prompt = (
        "You are a skill matcher for an ATS system. "
        "Given JD skills that did not match and resume skills, "
        "find semantic equivalences (acronyms, synonyms, informal names). "
        'Return JSON only: {"matches": [{"jd": "skill", "resume": "skill"}]}. '
        "Only include confident matches. Empty array if none."
    )
    user_content = json.dumps(
        {"unmatched_jd_skills": unmatched_jd_skills, "resume_skills": resume_skills},
        ensure_ascii=True,
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": JD_PARSE_MODEL,
                    "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0,
                    "max_tokens": 300,
                    "response_format": {"type": "json_object"},
                },
            )
        if response.status_code >= 400:
            logger.warning("skill semantic LLM HTTP %s", response.status_code)
            return {}
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw if isinstance(raw, str) else str(raw))
        matches = parsed.get("matches", [])
        result = {
            m["jd"]: m["resume"]
            for m in matches
            if isinstance(m, dict) and "jd" in m and "resume" in m
        }
        await _redis_set_json(cache_key, result, SKILL_SEMANTIC_CACHE_TTL_SECONDS)
        return result
    except Exception as exc:
        logger.warning("skill semantic LLM failed: %s", exc)
        return {}


_ROLE_KEYWORDS = {
    "engineering": {
        "engineer",
        "developer",
        "sde",
        "software",
        "backend",
        "frontend",
        "full stack",
    },
    "data_science": {
        "data scientist",
        "data science",
        "ml engineer",
        "machine learning",
        "ai engineer",
        "analyst",
    },
    "management": {"manager", "head", "director", "vp", "chief", "owner"},
    "research": {"research", "scientist", "applied scientist"},
    "sales": {"sales", "account executive", "business development"},
    "design": {"designer", "ux", "ui", "product design"},
}
_ENGINEERING_FIELDS = {
    "cs",
    "computer science",
    "engineering",
    "math",
    "mathematics",
    "stats",
    "statistics",
}
_FIELD_ALIASES = {
    "ai ml": "computer science",
    "ai & ml": "computer science",
    "artificial intelligence": "computer science",
    "computer science": "computer science",
    "cse": "computer science",
    "data science": "data science",
    "engineering": "engineering",
    "math": "math",
    "mathematics": "math",
    "statistics": "stats",
}
_SENIORITY_LEVELS = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "lead": 4,
    "principal": 5,
    "executive": 6,
}
_WEIGHTS = {
    "engineering": (0.50, 0.35, 0.15),
    "data_science": (0.45, 0.30, 0.25),
    "management": (0.25, 0.55, 0.20),
    "research": (0.35, 0.30, 0.35),
    "sales": (0.25, 0.55, 0.20),
    "design": (0.50, 0.35, 0.15),
    "other": (0.45, 0.35, 0.20),
}
_EVIDENCE_WEIGHTS = {
    "work": 1.5,
    "project": 1.2,
    "projects": 1.2,
    "skills": 1.0,
    "cert": 0.8,
    "summary": 0.7,
    "fallback": 0.7,
}

_JD_PARSE_SYSTEM_PROMPT = """Return strict JSON only.

Parse this job description into:
skills_required, skills_optional, experience_years, seniority_level, education_required, domain, role_family

Rules:
- technical skills only
- no soft skills
- unknown should be null or []
- role_family should be one of engineering, data_science, management, research, sales, design, other
- seniority_level should be one of intern, junior, mid, senior, lead, principal, executive"""

_SCORER_SYSTEM_PROMPT = """Return strict JSON only.

Score this candidate against the job description and return:
skills_match, experience_match, seniority_match, education_match, overall, matched_skills, missing_skills

Rules:
- synonyms count as equal
- if 5 or more skills match, skills_match must be at least 60
- never return 0 for skills if matches exist
- use internships as experience
- matched_skills and missing_skills should contain only technical skills"""


@dataclass
class JDStructure:
    skills_required: list[str]
    skills_optional: list[str]
    experience_years: int | None
    education: list[str]
    domain: str | None
    jd_text: str
    seniority_level: str
    role_family: str


@dataclass
class ResumeStructure:
    skills: list[str]
    work_experience: list[dict[str, Any]]
    projects: list[dict[str, Any]]
    certifications: list[str]
    education: list[str]
    summary: str
    total_years: float
    role_families: list[str]
    skill_evidence: dict[str, list[str]]
    relevant_years: float
    seniority_level: str
    education_fields: list[str]


@dataclass
class ResumeScoreResult:
    score: int | None
    status: str
    sections: dict[str, Any]


def _normalize_text(value: str | None) -> str:
    lowered = (value or "").lower()
    lowered = _NORMALIZE_RE.sub(" ", lowered)
    return _SPACE_RE.sub(" ", lowered).strip()


def _normalize_phrase(value: str | None, *, max_words: int = _MAX_SKILL_WORDS) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    words = [word for word in text.split() if word not in _STOPWORDS]
    if not words or len(words) > max_words:
        return ""
    return " ".join(words)


def _canonical_skill(value: str | None) -> str:
    """Sync canonical skill — returns normalized phrase only (no ESCO).
    Used in non-async contexts like text extraction.
    """
    phrase = _normalize_phrase(value)
    return phrase


async def _canonical_skill_async(value: str | None) -> str:
    """ESCO + Embedding aware canonical skill resolver.
    1. ESCO Redis lookup
    2. Raw normalized phrase (embedding matching happens at score time)
    """
    phrase = _normalize_phrase(value)
    if not phrase:
        return ""
    esco_result = await lookup_esco(phrase)
    if esco_result:
        return esco_result
    return phrase


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _expand_parentheses(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        head = match.group(1).strip()
        inner = match.group(2).strip()
        parts = [head] + [part.strip() for part in re.split(r"[,/|]", inner) if part.strip()]
        return ", ".join(parts)

    return re.sub(r"([A-Za-z0-9 +./-]+)\(([^)]+)\)", repl, text or "")


def _looks_like_technical_skill(skill: str) -> bool:
    if not skill or len(skill) < _MIN_SKILL_LENGTH:
        return False
    words = skill.split()
    if len(words) > _MAX_SKILL_WORDS:
        return False
    if skill in _SOFT_SKILL_TERMS:
        return False
    if any(word in _VERBS or word in _GENERIC_SKILL_WORDS for word in words):
        return False
    return True


def _extract_skills_from_text(text: str) -> list[str]:
    expanded = _expand_parentheses(text)
    found: list[str] = []
    for raw_part in re.split(r"[,|\n;:()]+", expanded):
        skill = _canonical_skill(raw_part)
        if _looks_like_technical_skill(skill):
            found.append(skill)
    return _dedupe(found)


def _extract_experience_years(text: str) -> int | None:
    matches = [int(match.group(1)) for match in _YEARS_RE.finditer(text or "")]
    return max(matches) if matches else None


def _extract_education_list(text: str) -> list[str]:
    normalized = _normalize_text(text)
    labels: list[str] = []
    if "phd" in normalized or "doctorate" in normalized:
        labels.append("phd")
    if "master" in normalized or "mba" in normalized:
        labels.append("master")
    if "bachelor" in normalized or "undergraduate" in normalized:
        labels.append("bachelor")
    if "associate" in normalized:
        labels.append("associate")
    if "high school" in normalized:
        labels.append("high school")
    return _dedupe(labels)


def _extract_education_fields_from_text(text: str) -> list[str]:
    normalized = _normalize_text(text)
    found = [canonical for alias, canonical in _FIELD_ALIASES.items() if alias in normalized]
    return _dedupe(found)


def _infer_role_family(text: str) -> str:
    normalized = _normalize_text(text)
    for family, keywords in _ROLE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return family
    return "other"


def _infer_seniority_from_title(title: str | None) -> str:
    normalized = _normalize_text(title)
    if any(token in normalized for token in ("intern", "trainee", "apprentice")):
        return "intern"
    if any(token in normalized for token in ("junior", "jr", "associate", "entry")):
        return "junior"
    if any(token in normalized for token in ("director", "vp", "head", "chief", "cto", "ceo")):
        return "executive"
    if "principal" in normalized:
        return "principal"
    if any(token in normalized for token in ("lead", "architect", "manager")):
        return "lead"
    if any(token in normalized for token in ("senior", "sr", "staff")):
        return "senior"
    return "mid"


def _infer_seniority_from_years(years: float) -> str:
    if years <= 1:
        return "intern"
    if years <= 3:
        return "junior"
    if years <= 6:
        return "mid"
    if years <= 10:
        return "senior"
    if years <= 15:
        return "lead"
    return "principal"


def _infer_domain(*values: str) -> str | None:
    normalized = " ".join(_normalize_text(value) for value in values if value)
    if "fintech" in normalized:
        return "fintech"
    if "healthcare" in normalized or "health" in normalized:
        return "healthcare"
    if "saas" in normalized or "software as a service" in normalized:
        return "saas"
    if "energy" in normalized:
        return "energy"
    if (
        "ai" in normalized
        or "machine learning" in normalized
        or "natural language processing" in normalized
    ):
        return "ai"
    return None


def _parse_resume_date(value: str | None) -> tuple[int, int] | None:
    text = _normalize_text(value)
    if not text:
        return None
    if text in {"present", "current", "now"}:
        now = datetime.now(timezone.utc)
        return now.year, now.month
    match = re.match(r"^(\d{4})(?:\s+(\d{1,2}))?$", text)
    if match:
        return int(match.group(1)), int(match.group(2) or "1")
    month_match = re.match(
        r"^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})$", text
    )
    if month_match:
        months = {
            "jan": 1,
            "feb": 2,
            "mar": 3,
            "apr": 4,
            "may": 5,
            "jun": 6,
            "jul": 7,
            "aug": 8,
            "sep": 9,
            "oct": 10,
            "nov": 11,
            "dec": 12,
        }
        return int(month_match.group(2)), months[month_match.group(1)[:3]]
    return None


def _months_between(start: tuple[int, int], end: tuple[int, int]) -> int:
    return max(0, (end[0] - start[0]) * 12 + (end[1] - start[1]))


def _recency_weight(end_date: str | None) -> float:
    normalized = _normalize_text(end_date)
    if not normalized or normalized in {"present", "current", "now"}:
        return 1.0
    parsed = _parse_resume_date(end_date)
    if not parsed:
        return 1.0
    now = datetime.now(timezone.utc)
    years_ago = (now.year - parsed[0]) + ((now.month - parsed[1]) / 12)
    if years_ago < 3:
        return 1.0
    if years_ago < 7:
        return 0.7
    return 0.4


def _safe_sha256(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def _redis_get_json(key: str) -> dict[str, Any] | None:
    try:
        raw = await get_redis_client().get(key)
        if not raw:
            return None
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        logger.warning("redis get failed key=%s: %s", key, exc)
        return None


async def _redis_set_json(key: str, value: dict[str, Any], ttl_seconds: int) -> None:
    try:
        await get_redis_client().setex(key, ttl_seconds, json.dumps(value))
    except Exception as exc:
        logger.warning("redis set failed key=%s: %s", key, exc)


def _extract_heuristic_jd_structure(
    *, job_title: str, job_description: str | None, category: str | None
) -> JDStructure:
    description = job_description or ""
    required: list[str] = []
    optional: list[str] = []
    current_bucket = "required"
    for raw_line in description.splitlines():
        line = raw_line.strip(" -*•\t")
        if not line:
            continue
        normalized = _normalize_text(line)
        if any(label in normalized for label in ("preferred", "nice to have", "good to have")):
            current_bucket = "optional"
            continue
        if any(
            label in normalized for label in ("required", "must have", "experience with", "skills")
        ):
            current_bucket = "required"
            continue
        extracted = _extract_skills_from_text(line)
        if current_bucket == "optional":
            optional.extend(extracted)
        else:
            required.extend(extracted)

    combined_role_text = " ".join(part for part in [job_title, category, description[:300]] if part)
    seniority = _infer_seniority_from_title(combined_role_text)
    role_family = _infer_role_family(combined_role_text)
    return JDStructure(
        skills_required=_dedupe(required),
        skills_optional=_dedupe([skill for skill in optional if skill not in required]),
        experience_years=_extract_experience_years(description),
        education=_extract_education_list(description),
        domain=_infer_domain(job_title or "", category or "", description),
        jd_text=description,
        seniority_level=seniority,
        role_family=role_family,
    )


async def _parse_jd_with_llm(
    *, job_title: str, job_description: str | None, category: str | None
) -> dict[str, Any] | None:
    if not (settings.openai_api_key or "").strip():
        return None
    payload = {
        "model": JD_PARSE_MODEL,
        "messages": [
            {"role": "system", "content": _JD_PARSE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "job_title": job_title,
                        "category": category,
                        "job_description": job_description or "",
                    },
                    ensure_ascii=True,
                ),
            },
        ],
        "temperature": 0,
        "max_tokens": 800,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 400:
            logger.warning("jd parser LLM HTTP %s", response.status_code)
            return None
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw if isinstance(raw, str) else str(raw))
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        logger.warning("jd parser LLM failed: %s", exc)
        return None


def _build_jd_structure_from_llm(
    llm_data: dict[str, Any],
    *,
    job_title: str,
    job_description: str | None,
    category: str | None,
) -> JDStructure:
    heuristic = _extract_heuristic_jd_structure(
        job_title=job_title,
        job_description=job_description,
        category=category,
    )
    required = _dedupe(
        [
            _canonical_skill(str(item))
            for item in llm_data.get("skills_required", [])
            if _canonical_skill(str(item))
        ]
    )
    optional = _dedupe(
        [
            _canonical_skill(str(item))
            for item in llm_data.get("skills_optional", [])
            if _canonical_skill(str(item))
        ]
    )
    education = _dedupe(
        [
            item
            for raw in llm_data.get("education_required", [])
            for item in _extract_education_list(str(raw))
        ]
    )
    seniority = str(llm_data.get("seniority_level") or "").strip().lower()
    role_family = str(llm_data.get("role_family") or "").strip().lower()
    return JDStructure(
        skills_required=required or heuristic.skills_required,
        skills_optional=[
            skill for skill in optional if skill not in (required or heuristic.skills_required)
        ],
        experience_years=llm_data.get("experience_years")
        if isinstance(llm_data.get("experience_years"), int)
        else heuristic.experience_years,
        education=education or heuristic.education,
        domain=str(llm_data.get("domain")).strip().lower()
        if llm_data.get("domain")
        else heuristic.domain,
        jd_text=job_description or "",
        seniority_level=seniority if seniority in _SENIORITY_LEVELS else heuristic.seniority_level,
        role_family=role_family if role_family in _WEIGHTS else heuristic.role_family,
    )


async def _parse_jd_structure(
    *, job_title: str, job_description: str | None, category: str | None
) -> JDStructure:
    description = job_description or ""
    cache_payload = json.dumps(
        {"title": job_title, "description": description}, sort_keys=True, ensure_ascii=True
    )
    cache_key = f"{JD_PARSE_CACHE_PREFIX}{_safe_sha256(cache_payload)}"
    cached = await _redis_get_json(cache_key)
    if cached is not None:
        try:
            return _build_jd_structure_from_llm(
                cached, job_title=job_title, job_description=job_description, category=category
            )
        except Exception:
            pass

    llm_parsed = await _parse_jd_with_llm(
        job_title=job_title, job_description=job_description, category=category
    )
    if llm_parsed is not None:
        await _redis_set_json(cache_key, llm_parsed, JD_PARSE_CACHE_TTL_SECONDS)
        try:
            return _build_jd_structure_from_llm(
                llm_parsed, job_title=job_title, job_description=job_description, category=category
            )
        except Exception:
            pass
    return _extract_heuristic_jd_structure(
        job_title=job_title, job_description=job_description, category=category
    )


def _max_evidence_weight(sources: list[str]) -> float:
    return max((_EVIDENCE_WEIGHTS.get(source, 1.0) for source in sources), default=1.0)


def _skill_matches_resolved(left: str, right: str) -> bool:
    """Match two already-canonicalized skill strings."""
    if not left or not right:
        return False
    if left == right:
        return True
    if left in right or right in left:
        return True
    return False


def _skill_matches(required_skill: str, resume_skill: str) -> bool:
    """Sync skill match — used as fallback only."""
    left = _canonical_skill(required_skill)
    right = _canonical_skill(resume_skill)
    if not left or not right:
        return False
    if left == right:
        return True
    if left in right or right in left:
        return True
    return False


async def _score_skills(
    jd: JDStructure, resume: ResumeStructure
) -> tuple[int, list[str], list[str]]:
    required = jd.skills_required
    if not required:
        return 0, [], []

    matched: list[str] = []
    missing: list[str] = []
    weighted_matched = 0.0
    weighted_required = float(len(required))
    used_resume_skills: set[str] = set()

    # resolve all skills through ESCO
    resolved_required = [await _canonical_skill_async(s) for s in required]
    resolved_resume = [await _canonical_skill_async(s) for s in resume.skills]

    # tier 1: ESCO resolved exact + substring match
    for idx, required_skill in enumerate(resolved_required):
        matched_resume = ""
        best_weight = 0.0
        for r_idx, resume_skill in enumerate(resolved_resume):
            orig_resume_skill = resume.skills[r_idx]
            if orig_resume_skill in used_resume_skills:
                continue
            if _skill_matches_resolved(required_skill, resume_skill):
                weight = _max_evidence_weight(resume.skill_evidence.get(orig_resume_skill, []))
                if weight > best_weight:
                    best_weight = weight
                    matched_resume = orig_resume_skill
        if matched_resume:
            used_resume_skills.add(matched_resume)
            matched.append(required[idx])
            weighted_matched += best_weight or 1.0
        else:
            missing.append(required[idx])

    # tier 2: LLM semantic match for all unmatched skills in ONE call
    if missing:
        available_resume = [s for s in resume.skills if s not in used_resume_skills]
        semantic_map = await _llm_semantic_skill_match(missing, available_resume)
        if semantic_map:
            still_missing: list[str] = []
            for jd_skill in missing:
                resume_skill = semantic_map.get(jd_skill)
                if resume_skill and resume_skill not in used_resume_skills:
                    used_resume_skills.add(resume_skill)
                    matched.append(jd_skill)
                    weight = (
                        _max_evidence_weight(resume.skill_evidence.get(resume_skill, [])) * 0.9
                    )  # slight discount for semantic match
                    weighted_matched += weight or 0.9
                else:
                    still_missing.append(jd_skill)
            missing = still_missing

    score = round((weighted_matched / weighted_required) * 100) if weighted_required > 0 else 0
    if len(matched) >= 5:
        score = max(score, 60)
    return min(100, max(0, score)), _dedupe(matched), _dedupe(missing)


def _calculate_total_years(work_experience: list[dict[str, Any]]) -> float:
    total_months = 0.0
    for item in work_experience:
        start = _parse_resume_date(item.get("start"))
        end = _parse_resume_date(item.get("end"))
        if not start or not end:
            continue
        months = _months_between(start, end)
        total_months += months
    return round(total_months / 12, 1)


def _calculate_relevant_years(profile: ResumeProfile, role_family: str) -> float:
    months = 0.0
    family_hint = role_family.replace("_", " ")
    for item in profile.work_experience:
        start = _parse_resume_date(item.start_date)
        end = _parse_resume_date(item.end_date)
        if not start or not end:
            continue
        raw_months = _months_between(start, end)
        title_text = _normalize_text(item.title)
        body_text = _normalize_text(" ".join(item.highlights or []))
        combined = " ".join(part for part in [title_text, body_text] if part)
        relevance = 1.0 if family_hint in combined else 0.7
        if role_family == "engineering" and any(
            token in combined
            for token in ("python", "backend", "software", "full stack", "flask", "fastapi")
        ):
            relevance = max(relevance, 1.0)
        if role_family == "data_science" and any(
            token in combined for token in ("machine learning", "data", "nlp", "llm", "analytics")
        ):
            relevance = max(relevance, 1.0)
        internship_weight = 0.75 if "intern" in title_text else 1.0
        months += raw_months * relevance * internship_weight * _recency_weight(item.end_date)

    if months == 0:
        project_months = min(len(profile.section_map.get("projects", "").splitlines()) * 2, 12)
        months += project_months * 0.5
    return round(months / 12, 1)


async def _verify_experience_relevance_with_llm(
    jd: JDStructure,
    resume: ResumeStructure,
) -> bool:
    """Ask LLM if resume work experience is relevant to the JD.
    Returns True (relevant) on any failure so we never penalize on LLM error.
    """
    if not (settings.openai_api_key or "").strip():
        return True

    exp_titles = [
        {"title": item.get("title") or "", "description": (item.get("description") or "")[:200]}
        for item in resume.work_experience
        if item.get("title")
    ]
    if not exp_titles:
        return resume.total_years == 0  # no experience at all → treat as relevant (score by years)

    cache_payload = json.dumps(
        {
            "jd_role": jd.role_family,
            "jd_skills": sorted(jd.skills_required[:10]),
            "exp_titles": [e["title"] for e in exp_titles],
        },
        sort_keys=True,
        ensure_ascii=True,
    )
    cache_key = f"{EXP_RELEVANCE_CACHE_PREFIX}{_safe_sha256(cache_payload)}"

    cached = await _redis_get_json(cache_key)
    if cached is not None:
        return bool(cached.get("relevant", True))

    user_content = json.dumps(
        {
            "jd_role_family": jd.role_family,
            "jd_required_skills": jd.skills_required[:10],
            "resume_experience": exp_titles,
        },
        ensure_ascii=True,
    )
    request_payload = {
        "model": JD_PARSE_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a strict ATS experience relevance checker for a global hiring platform. "
                    "Your job: decide if the candidate's work experience is FUNCTIONALLY relevant to the job. "
                    "\n\nRules:"
                    "\n- Same functional domain = true (engineer->engineer, PM->PM, designer->designer, sales->sales)"
                    "\n- Adjacent functional domain with clear overlap = true (data analyst->data scientist, SDE->ML engineer)"
                    "\n- Different functional domain = false even if same industry (engineer->PM, sales->engineer, chef->any tech role)"
                    "\n- Industry overlap alone is NOT enough (built SaaS as engineer != PM experience)"
                    "\n- Internships and junior roles count if same function"
                    "\n- Projects count only if they demonstrate the required function, not just the industry"
                    "\n\nExamples of false: engineer->PM, chef->AI, waiter->PM, HR->engineer, sales->data scientist"
                    "\nExamples of true: SDE intern->software engineer, data scientist->ML engineer, junior PM->senior PM, sales exec->BD manager"
                    '\n\nAnswer with JSON only: {"relevant": true} or {"relevant": false}. No explanation.'
                ),
            },
            {"role": "user", "content": user_content},
        ],
        "temperature": 0,
        "max_tokens": 20,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
            )
        if response.status_code >= 400:
            logger.warning("exp relevance LLM HTTP %s", response.status_code)
            return True
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw if isinstance(raw, str) else str(raw))
        result = bool(parsed.get("relevant", True))
        await _redis_set_json(cache_key, {"relevant": result}, EXP_RELEVANCE_CACHE_TTL_SECONDS)
        return result
    except Exception as exc:
        logger.warning("exp relevance LLM failed: %s", exc)
        return True  # fail open


async def compute_experience_score(
    jd: JDStructure,
    resume: ResumeStructure,
    skills_score: int,
) -> int:
    """Compute experience score.

    skills >= 50 → experience clearly relevant, use years math directly.
    skills < 50  → verify relevance via LLM first.
                   irrelevant → 0
                   relevant   → apply years math (or 100 if no requirement).
    """
    required = jd.experience_years

    if skills_score < 50:
        is_relevant = await _verify_experience_relevance_with_llm(jd, resume)
        if not is_relevant:
            return 0

    # experience is relevant (either skills >= 50 or LLM confirmed)
    if required is None or required <= 0:
        return 100

    if not resume.role_families:
        actual = max(resume.relevant_years, resume.total_years * 0.8)
    elif jd.role_family != "other" and jd.role_family not in resume.role_families:
        actual = resume.relevant_years
    else:
        actual = max(resume.relevant_years, resume.total_years * 0.8)

    if actual >= required:
        return 100
    return min(100, max(0, round((actual / required) * 100)))


def compute_education_score(jd: JDStructure, resume: ResumeStructure) -> int | None:
    if not jd.education:
        return None
    levels = {"high school": 1, "associate": 2, "bachelor": 3, "master": 4, "phd": 5}
    jd_max = max((levels.get(item, 0) for item in jd.education), default=0)
    resume_max = max((levels.get(item, 0) for item in resume.education), default=0)
    if jd_max == 0:
        return None
    if resume_max >= jd_max:
        score = 100
    elif resume_max == jd_max - 1:
        score = 50
    else:
        score = 0
    if jd.role_family in {"engineering", "data_science"} and any(
        field in _ENGINEERING_FIELDS for field in resume.education_fields
    ):
        score = min(100, score + 15)
    return score


def blend_scores(scores: dict[str, int | None], weights: tuple[float, float, float]) -> float:
    keys = ["skills", "experience", "education"]
    active = {k: scores[k] for k in keys if scores.get(k) is not None}
    if not active:
        return 0.0
    weight_map = dict(zip(keys, weights))
    total_weight = sum(weight_map[k] for k in active)
    if total_weight == 0:
        return 0.0
    if len(active) == 1 and "skills" in active:
        return float(active["skills"])
    return sum(active[k] * weight_map[k] / total_weight for k in active)


def relevance_multiplier(skills_score: int) -> float:
    if skills_score < 20:
        return 0.3
    if skills_score < 40:
        return 0.6
    if skills_score < 60:
        return 0.85
    return 1.0


def role_mismatch_penalty(jd: JDStructure, resume: ResumeStructure, skills_score: int) -> float:
    if (
        jd.role_family != "other"
        and resume.role_families
        and jd.role_family not in resume.role_families
        and skills_score < 50
    ):
        return 0.7
    return 1.0


def _score_seniority(jd: JDStructure, resume: ResumeStructure) -> int:
    jd_level = _SENIORITY_LEVELS.get(jd.seniority_level, 2)
    resume_level = _SENIORITY_LEVELS.get(resume.seniority_level, 2)
    diff = abs(jd_level - resume_level)
    if diff == 0:
        return 100
    if diff == 1:
        return 75
    if diff == 2:
        return 45
    return 15


def extract_resume_structure(parsed_resume: dict[str, Any]) -> ResumeStructure | None:
    try:
        profile = ResumeProfile.model_validate(parsed_resume)
    except Exception:
        return None

    skill_evidence: dict[str, list[str]] = {}

    def add_skill(skill: str, source: str) -> None:
        if not skill:
            return
        bucket = skill_evidence.setdefault(skill, [])
        if source not in bucket:
            bucket.append(source)

    for skill in profile.skills:
        for extracted in _extract_skills_from_text(skill.name):
            add_skill(extracted, "skills")

    for certification in profile.certifications:
        cert_text = " ".join(part for part in [certification.name, certification.issuer] if part)
        for extracted in _extract_skills_from_text(cert_text):
            add_skill(extracted, "cert")

    summary = profile.summary or ""
    for extracted in _extract_skills_from_text(summary):
        add_skill(extracted, "summary")

    work_experience: list[dict[str, Any]] = []
    role_families: list[str] = []
    resume_titles: list[str] = []
    for item in profile.work_experience:
        resume_titles.append(item.title or "")
        title_family = _infer_role_family(item.title or "")
        if title_family != "other":
            role_families.append(title_family)
        description = " ".join(item.highlights or [])
        combined_text = " ".join(part for part in [item.title, item.company, description] if part)
        for extracted in _extract_skills_from_text(combined_text):
            add_skill(extracted, "work")
        work_experience.append(
            {
                "title": item.title,
                "description": description,
                "start": item.start_date,
                "end": item.end_date,
            }
        )

    projects_text = profile.section_map.get("projects", "")
    projects = [
        {"description": line.strip()} for line in projects_text.splitlines() if line.strip()
    ]
    for extracted in _extract_skills_from_text(projects_text):
        add_skill(extracted, "project")

    if len(skill_evidence) < 5:
        full_text = " ".join(
            [
                summary,
                projects_text,
                " ".join(" ".join(item.highlights or []) for item in profile.work_experience),
            ]
        )
        for extracted in _extract_skills_from_text(full_text):
            add_skill(extracted, "fallback")

    education_levels: list[str] = []
    education_fields: list[str] = []
    for item in profile.education:
        combined = " ".join(part for part in [item.degree, item.field] if part)
        education_levels.extend(_extract_education_list(combined))
        education_fields.extend(_extract_education_fields_from_text(combined))

    total_years = _calculate_total_years(work_experience)
    seniority = _infer_seniority_from_years(total_years)
    if resume_titles:
        title_based = _infer_seniority_from_title(" ".join(resume_titles))
        if _SENIORITY_LEVELS.get(title_based, 2) > _SENIORITY_LEVELS.get(seniority, 2):
            seniority = title_based

    role_family = (
        role_families[0]
        if role_families
        else _infer_role_family(" ".join(resume_titles) + " " + summary)
    )
    relevant_years = _calculate_relevant_years(profile, role_family)

    return ResumeStructure(
        skills=_dedupe(list(skill_evidence.keys())),
        work_experience=work_experience,
        projects=projects,
        certifications=[
            " ".join(part for part in [item.name, item.issuer] if part)
            for item in profile.certifications
        ],
        education=_dedupe(education_levels),
        summary=summary,
        total_years=total_years,
        role_families=_dedupe(role_families or [role_family]),
        skill_evidence=skill_evidence,
        relevant_years=relevant_years,
        seniority_level=seniority,
        education_fields=_dedupe(education_fields),
    )


SINGLE_SCORE_CACHE_PREFIX = "ats:resume-score:v3:"
SINGLE_SCORE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
SINGLE_SCORE_MAX_JD_CHARS = 4000
SINGLE_SCORE_MAX_RESUME_CHARS = 5000

_SINGLE_SCORE_SYSTEM_PROMPT = """You are a world-class ATS scoring engine for a global hiring platform.
Given a Job Description and a Resume, score the candidate accurately.

Rules:
- Treat synonyms as equal: EDA=exploratory data analysis, ML=machine learning,
  gen ai=generative ai, NLP=natural language processing, k8s=kubernetes,
  JS=javascript, TS=typescript, LLM=large language models, CV=computer vision,
  CI/CD=ci cd, OOP=object oriented programming, AWS=amazon web services
- Internships count as real experience (0.75x weight)
- experience_score: if no years required=100, if irrelevant domain=0,
  else round(actual_years/required_years*100) capped at 100
- skills_score: % of required skills candidate demonstrably has
  (work bullets and projects count as evidence, not just skills section)
- If 5+ skills match, skills_score must be >= 60
- education_score: null if JD has no degree requirement,
  else 100=meets, 50=one level below, 0=two+ levels below
- total_score: weighted blend based on role type
- Never return 0 for skills if clear matches exist
- Be strict on domain mismatch: chef->AI=0 experience, engineer->PM=0 experience

Return JSON only, no markdown:
{
  "skills_score": int,
  "experience_score": int,
  "education_score": int or null,
  "total_score": int,
  "matched_skills": [list of matched skill strings],
  "missing_skills": [list of missing skill strings],
  "explanation": {
    "summary": "one sentence summary",
    "highlights": ["list of positive points"],
    "gaps": ["list of gaps"]
  }
}"""


def _build_resume_text(parsed_resume: dict[str, Any]) -> str:
    """Build a compact resume text from parsed_resume dict for LLM input."""
    try:
        profile = ResumeProfile.model_validate(parsed_resume)
    except Exception:
        return json.dumps(parsed_resume, ensure_ascii=True)[:SINGLE_SCORE_MAX_RESUME_CHARS]

    parts: list[str] = []
    if profile.summary:
        parts.append(f"Summary: {profile.summary}")

    if profile.work_experience:
        parts.append("Experience:")
        for w in profile.work_experience:
            line = f"- {w.title or ''} at {w.company or ''} ({w.start_date or ''} - {w.end_date or 'present'})"
            if w.highlights:
                line += ": " + "; ".join(w.highlights[:3])
            parts.append(line)

    if profile.education:
        parts.append("Education:")
        for e in profile.education:
            parts.append(f"- {e.degree or ''} in {e.field or ''} from {e.institution or ''}")

    if profile.skills:
        parts.append("Skills: " + ", ".join(s.name for s in profile.skills if s.name))

    if profile.certifications:
        parts.append(
            "Certifications: " + ", ".join(c.name for c in profile.certifications if c.name)
        )

    projects = profile.section_map.get("projects", "")
    if projects:
        parts.append(f"Projects: {projects[:500]}")

    return "\n".join(parts)[:SINGLE_SCORE_MAX_RESUME_CHARS]


def _validate_llm_score(result: dict[str, Any]) -> bool:
    """Detect hallucinations. Returns True if result is sane, False if suspicious."""
    skills = result.get("skills_score", -1)
    experience = result.get("experience_score", -1)
    education = result.get("education_score")
    total = result.get("total_score", -1)
    matched = result.get("matched_skills", [])

    # all required fields present and in range
    if not all(isinstance(v, int) for v in [skills, experience, total]):
        return False
    if not all(0 <= v <= 100 for v in [skills, experience, total]):
        return False
    if education is not None and not (isinstance(education, int) and 0 <= education <= 100):
        return False

    # total can't be high if skills are very low
    if total > 70 and skills < 20:
        logger.warning("llm hallucination: total=%s but skills=%s", total, skills)
        return False

    # can't claim high skills match with no matched skills listed
    if skills > 60 and isinstance(matched, list) and len(matched) == 0:
        logger.warning("llm hallucination: skills=%s but matched_skills empty", skills)
        return False

    # total should be roughly consistent with component scores
    min_possible = min(skills, experience) * 0.3
    if total > 95 and skills < 70:
        logger.warning("llm hallucination: total=%s but skills=%s", total, skills)
        return False
    if total < min_possible * 0.5 and total < 5:
        pass  # allow very low scores

    return True


async def _score_with_single_llm_call(
    *,
    job_title: str,
    job_description: str | None,
    parsed_resume: dict[str, Any],
) -> dict[str, Any] | None:
    """Single LLM call scoring. Returns full result dict or None on failure."""
    if not (settings.openai_api_key or "").strip():
        return None

    jd_text = f"Job Title: {job_title}\n\n{(job_description or '')[:SINGLE_SCORE_MAX_JD_CHARS]}"
    resume_text = _build_resume_text(parsed_resume)

    cache_key = f"{SINGLE_SCORE_CACHE_PREFIX}{_safe_sha256(jd_text + resume_text)}"
    cached = await _redis_get_json(cache_key)
    if cached is not None:
        if _validate_llm_score(cached):
            return cached
        logger.warning("cached llm score failed validation, re-scoring")

    user_content = f"JD:\n{jd_text}\n\nResume:\n{resume_text}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": SCORING_MODEL,
                    "messages": [
                        {"role": "system", "content": _SINGLE_SCORE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0,
                    "max_tokens": 600,
                    "response_format": {"type": "json_object"},
                },
            )
        if response.status_code >= 400:
            logger.warning("single score LLM HTTP %s", response.status_code)
            return None
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw if isinstance(raw, str) else str(raw))
        if not isinstance(parsed, dict):
            return None
        if not _validate_llm_score(parsed):
            logger.warning("single score LLM failed validation, falling back to heuristic")
            return None
        await _redis_set_json(cache_key, parsed, SINGLE_SCORE_CACHE_TTL_SECONDS)
        return parsed
    except Exception as exc:
        logger.warning("single score LLM failed: %s", exc)
        return None


async def _score_with_llm(
    *,
    jd: JDStructure,
    resume: ResumeStructure,
    heuristic_score: int,
    matched_skills: list[str],
    missing_skills: list[str],
) -> dict[str, Any] | None:
    if not (settings.openai_api_key or "").strip():
        return None
    payload = {
        "jd": {
            "skills_required": jd.skills_required,
            "skills_optional": jd.skills_optional,
            "experience_years": jd.experience_years,
            "seniority_level": jd.seniority_level,
            "education": jd.education,
            "role_family": jd.role_family,
        },
        "resume": {
            "skills": resume.skills,
            "relevant_years": resume.relevant_years,
            "seniority_level": resume.seniority_level,
            "education": resume.education,
            "education_fields": resume.education_fields,
            "work_experience": resume.work_experience,
            "projects": resume.projects,
            "summary": resume.summary,
        },
        "heuristic_score": heuristic_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
    }
    cache_key = f"{SCORING_CACHE_PREFIX}{_safe_sha256(json.dumps(payload, sort_keys=True, ensure_ascii=True))}"
    cached = await _redis_get_json(cache_key)
    if cached is not None:
        return cached

    request_payload = {
        "model": SCORING_MODEL,
        "messages": [
            {"role": "system", "content": _SCORER_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=True)},
        ],
        "temperature": 0,
        "max_tokens": 800,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OPENAI_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
            )
        if response.status_code >= 400:
            logger.warning("resume scorer LLM HTTP %s", response.status_code)
            return None
        data = response.json()
        raw = data["choices"][0]["message"]["content"]
        parsed = json.loads(raw if isinstance(raw, str) else str(raw))
        if isinstance(parsed, dict):
            await _redis_set_json(cache_key, parsed, SCORING_CACHE_TTL_SECONDS)
            return parsed
    except Exception as exc:
        logger.warning("resume scorer LLM failed: %s", exc)
    return None


def _clamp_score(value: Any) -> int:
    try:
        score = int(round(float(value)))
    except Exception:
        score = 0
    return min(100, max(0, score))


def _clean_skill_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    for item in value:
        skill = _canonical_skill(str(item))
        if _looks_like_technical_skill(skill):
            cleaned.append(skill)
    return _dedupe(cleaned)


def _build_explanation(
    *,
    jd: JDStructure,
    resume: ResumeStructure,
    skills_score: int,
    exp_score: int,
    edu_score: int | None,
    matched_skills: list[str],
    missing_skills: list[str],
    scored_by: str,
) -> dict[str, Any]:
    highlights: list[str] = []
    gaps: list[str] = []

    # skills
    total_required = len(jd.skills_required)
    total_matched = len(matched_skills)
    if total_matched and total_required:
        top = ", ".join(matched_skills[:3])
        highlights.append(
            f"Matched {total_matched}/{total_required} required skills including {top}"
        )
    if missing_skills:
        gaps.append(f"Missing: {', '.join(missing_skills[:5])}")

    # experience
    if exp_score == 0:
        gaps.append("Work experience not relevant to this role")
    elif exp_score == 100:
        if jd.experience_years:
            highlights.append(f"Meets {jd.experience_years}+ year experience requirement")
        else:
            highlights.append("Experience verified relevant to role")
    else:
        actual = round(max(resume.relevant_years, resume.total_years * 0.8), 1)
        gaps.append(
            f"Experience below requirement: {actual} of {jd.experience_years} years required"
        )

    # education
    if edu_score is not None:
        if edu_score >= 100:
            highlights.append("Education meets job requirement")
        elif edu_score == 50:
            gaps.append("Education one level below requirement")
        elif edu_score == 0:
            gaps.append("Education does not meet minimum requirement")

    # summary
    if skills_score >= 70 and exp_score >= 80:
        summary = "Strong match. Meets most requirements."
    elif skills_score >= 50:
        summary = "Partial match. Some skill or experience gaps."
    elif skills_score < 20:
        summary = "Weak match. Significant skill gaps."
    else:
        summary = "Below average match. Key requirements missing."

    return {
        "summary": summary,
        "highlights": highlights,
        "gaps": gaps,
        "scored_by": scored_by,
    }


async def score_candidate_against_job(
    *,
    parsed_resume: dict[str, Any] | None,
    job_title: str,
    job_description: str | None,
    category: str | None,
    employment_type: str | None,
    workplace_type: str | None,
) -> ResumeScoreResult:
    try:
        if not parsed_resume:
            return ResumeScoreResult(score=None, status="failed", sections={})

        # --- PATH A: Single LLM call (fast, accurate, cost-efficient) ---
        llm_result = await _score_with_single_llm_call(
            job_title=job_title,
            job_description=job_description,
            parsed_resume=parsed_resume,
        )
        if llm_result is not None:
            skills_score = _clamp_score(llm_result.get("skills_score"))
            exp_score = _clamp_score(llm_result.get("experience_score"))
            edu_score_raw = llm_result.get("education_score")
            edu_score = _clamp_score(edu_score_raw) if edu_score_raw is not None else None
            total_score = _clamp_score(llm_result.get("total_score"))
            matched_skills = [str(s) for s in llm_result.get("matched_skills", []) if s]
            missing_skills = [str(s) for s in llm_result.get("missing_skills", []) if s]
            llm_explanation = llm_result.get("explanation", {})
            sections: dict[str, Any] = {
                "skills": skills_score,
                "experience": exp_score,
                "matched_skills": _dedupe(matched_skills),
                "missing_skills": _dedupe(missing_skills),
                "explanation": {
                    "summary": llm_explanation.get("summary", ""),
                    "highlights": llm_explanation.get("highlights", []),
                    "gaps": llm_explanation.get("gaps", []),
                },
            }
            if edu_score is not None:
                sections["education"] = edu_score
            return ResumeScoreResult(score=total_score, status="ready", sections=sections)

        # --- PATH B: Heuristic pipeline (fallback when LLM unavailable) ---
        jd = await _parse_jd_structure(
            job_title=job_title, job_description=job_description, category=category
        )
        resume = extract_resume_structure(parsed_resume)
        if resume is None:
            return ResumeScoreResult(score=None, status="failed", sections={})

        relevant_role_family = jd.role_family if jd.role_family in _WEIGHTS else "other"
        resume.relevant_years = _calculate_relevant_years(
            ResumeProfile.model_validate(parsed_resume), relevant_role_family
        )
        if _SENIORITY_LEVELS.get(resume.seniority_level, 2) == 2 and resume.relevant_years > 0:
            resume.seniority_level = _infer_seniority_from_years(resume.relevant_years)

        skills_score, matched_skills, missing_skills = await _score_skills(jd, resume)
        exp_score = await compute_experience_score(jd, resume, skills_score)
        edu_score = compute_education_score(jd, resume)

        weights = _WEIGHTS.get(relevant_role_family, _WEIGHTS["other"])
        base = blend_scores(
            {"skills": skills_score, "experience": exp_score, "education": edu_score},
            weights,
        )
        heuristic_score = round(
            base
            * relevance_multiplier(skills_score)
            * role_mismatch_penalty(jd, resume, skills_score)
        )
        heuristic_score = min(100, max(0, heuristic_score))
        final_score = heuristic_score
        scored_by = "heuristic"

        if 25 <= heuristic_score <= 80:
            blend_result = await _score_with_llm(
                jd=jd,
                resume=resume,
                heuristic_score=heuristic_score,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
            )
            if blend_result is not None:
                llm_overall = _clamp_score(blend_result.get("overall"))
                final_score = _clamp_score((heuristic_score * 0.4) + (llm_overall * 0.6))
                scored_by = "llm_blend"
                llm_matched = _clean_skill_list(blend_result.get("matched_skills"))
                llm_missing = _clean_skill_list(blend_result.get("missing_skills"))
                if llm_matched:
                    matched_skills = [skill for skill in llm_matched if skill in jd.skills_required]
                if llm_missing:
                    missing_skills = [
                        skill
                        for skill in llm_missing
                        if skill in jd.skills_required and skill not in matched_skills
                    ]

        missing_required = [s for s in missing_skills if s in jd.skills_required]
        missing_ratio = len(missing_required) / max(len(jd.skills_required), 1)
        if missing_ratio > 0.7:
            final_score = min(final_score, 30)

        sections = {
            "skills": _clamp_score(skills_score),
            "experience": _clamp_score(exp_score),
            "matched_skills": _dedupe(matched_skills),
            "missing_skills": _dedupe([s for s in missing_skills if s not in matched_skills]),
            "explanation": _build_explanation(
                jd=jd,
                resume=resume,
                skills_score=skills_score,
                exp_score=exp_score,
                edu_score=edu_score,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
                scored_by=scored_by,
            ),
        }
        if edu_score is not None:
            sections["education"] = _clamp_score(edu_score)
        return ResumeScoreResult(score=final_score, status="ready", sections=sections)
    except Exception as exc:
        logger.warning("resume scoring failed: %s", exc)
        return ResumeScoreResult(score=None, status="failed", sections={})
