"""Edge-case tests for the ATS resume scoring engine.

Tests are pure-function only — no DB, no Redis, no LLM calls.
All helpers under test are imported directly from resume_scoring.
"""

from __future__ import annotations

import pytest

from app.services.resume_scoring import (
    JDStructure,
    ResumeStructure,
    blend_scores,
    compute_education_score,
    compute_experience_score,
    relevance_multiplier,
    role_mismatch_penalty,
)

# ---------------------------------------------------------------------------
# Shared fixture builders
# ---------------------------------------------------------------------------


def _jd(
    *,
    skills_required: list[str],
    experience_years: int | None = None,
    education: list[str] | None = None,
    role_family: str = "engineering",
    seniority_level: str = "mid",
) -> JDStructure:
    return JDStructure(
        skills_required=skills_required,
        skills_optional=[],
        experience_years=experience_years,
        education=education or [],
        domain=None,
        jd_text="",
        seniority_level=seniority_level,
        role_family=role_family,
    )


def _resume(
    *,
    skills: list[str],
    total_years: float = 0.0,
    relevant_years: float = 0.0,
    education: list[str] | None = None,
    education_fields: list[str] | None = None,
    role_families: list[str] | None = None,
    seniority_level: str = "mid",
) -> ResumeStructure:
    return ResumeStructure(
        skills=skills,
        work_experience=[],
        projects=[],
        certifications=[],
        education=education or [],
        summary="",
        total_years=total_years,
        role_families=role_families or [],
        skill_evidence={s: ["skills"] for s in skills},
        relevant_years=relevant_years,
        seniority_level=seniority_level,
        education_fields=education_fields or [],
    )


# ---------------------------------------------------------------------------
# blend_scores
# ---------------------------------------------------------------------------


def test_blend_scores_drops_none_and_renormalizes() -> None:
    weights = (0.50, 0.35, 0.15)
    result = blend_scores({"skills": 80, "experience": None, "education": 100}, weights)
    # active: skills(0.50) + education(0.15) → total_weight=0.65
    expected = (80 * 0.50 + 100 * 0.15) / 0.65
    assert abs(result - expected) < 0.5


def test_blend_scores_only_skills_returns_skills_directly() -> None:
    weights = (0.50, 0.35, 0.15)
    result = blend_scores({"skills": 72, "experience": None, "education": None}, weights)
    assert result == 72.0


def test_blend_scores_all_present() -> None:
    weights = (0.50, 0.35, 0.15)
    result = blend_scores({"skills": 80, "experience": 60, "education": 100}, weights)
    expected = 80 * 0.50 + 60 * 0.35 + 100 * 0.15
    assert abs(result - expected) < 0.5


# ---------------------------------------------------------------------------
# relevance_multiplier
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "score,expected",
    [
        (0, 0.3),
        (19, 0.3),
        (20, 0.6),
        (39, 0.6),
        (40, 0.85),
        (59, 0.85),
        (60, 1.0),
        (100, 1.0),
    ],
)
def test_relevance_multiplier(score: int, expected: float) -> None:
    assert relevance_multiplier(score) == expected


# ---------------------------------------------------------------------------
# role_mismatch_penalty
# ---------------------------------------------------------------------------


def test_role_mismatch_penalty_applies() -> None:
    jd = _jd(skills_required=[], role_family="engineering")
    resume = _resume(skills=[], role_families=["sales"])
    assert role_mismatch_penalty(jd, resume, skills_score=30) == 0.7


def test_role_mismatch_penalty_no_penalty_when_skills_high() -> None:
    jd = _jd(skills_required=[], role_family="engineering")
    resume = _resume(skills=[], role_families=["sales"])
    assert role_mismatch_penalty(jd, resume, skills_score=55) == 1.0


def test_role_mismatch_penalty_no_penalty_when_other() -> None:
    jd = _jd(skills_required=[], role_family="other")
    resume = _resume(skills=[], role_families=["sales"])
    assert role_mismatch_penalty(jd, resume, skills_score=10) == 1.0


def test_role_mismatch_penalty_no_penalty_when_empty_role_families() -> None:
    jd = _jd(skills_required=[], role_family="engineering")
    resume = _resume(skills=[], role_families=[])
    assert role_mismatch_penalty(jd, resume, skills_score=10) == 1.0


# ---------------------------------------------------------------------------
# compute_experience_score
# ---------------------------------------------------------------------------


def test_experience_none_required_returns_100() -> None:
    jd = _jd(skills_required=[], experience_years=None)
    resume = _resume(skills=[], total_years=5.0, relevant_years=5.0)
    # skills >= 50 path (pass skills_score=60 to skip LLM)
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 100


def test_experience_zero_required_returns_100() -> None:
    jd = _jd(skills_required=[], experience_years=0)
    resume = _resume(skills=[], total_years=0.0, relevant_years=0.0)
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 100


def test_experience_meets_requirement_returns_100() -> None:
    jd = _jd(skills_required=[], experience_years=3)
    resume = _resume(skills=[], total_years=4.0, relevant_years=4.0, role_families=["engineering"])
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 100


def test_experience_proportional_score() -> None:
    jd = _jd(skills_required=[], experience_years=5, role_family="engineering")
    resume = _resume(skills=[], total_years=2.0, relevant_years=2.0, role_families=["engineering"])
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 40


def test_experience_domain_mismatch_uses_relevant_years() -> None:
    jd = _jd(skills_required=[], experience_years=5, role_family="engineering")
    resume = _resume(
        skills=[],
        total_years=10.0,
        relevant_years=1.0,
        role_families=["sales"],
    )
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 20


def test_experience_no_role_family_uses_total_years_floor() -> None:
    jd = _jd(skills_required=[], experience_years=5, role_family="engineering")
    resume = _resume(
        skills=[],
        total_years=4.0,
        relevant_years=0.5,
        role_families=[],
    )
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        compute_experience_score(jd, resume, skills_score=60)
    )
    assert result == 64


# ---------------------------------------------------------------------------
# compute_education_score
# ---------------------------------------------------------------------------


def test_education_no_requirement_returns_none() -> None:
    jd = _jd(skills_required=[], education=[])
    resume = _resume(skills=[], education=["bachelor"])
    assert compute_education_score(jd, resume) is None


def test_education_meets_requirement() -> None:
    jd = _jd(skills_required=[], education=["bachelor"])
    resume = _resume(skills=[], education=["master"])
    assert compute_education_score(jd, resume) == 100


def test_education_one_level_below() -> None:
    jd = _jd(skills_required=[], education=["master"])
    resume = _resume(skills=[], education=["bachelor"])
    assert compute_education_score(jd, resume) == 50


def test_education_field_bonus_applied() -> None:
    jd = _jd(skills_required=[], education=["bachelor"], role_family="engineering")
    resume = _resume(
        skills=[],
        education=["bachelor"],
        education_fields=["computer science"],
    )
    assert compute_education_score(jd, resume) == 100  # 100 + 15 capped at 100


def test_education_field_bonus_on_partial_match() -> None:
    jd = _jd(skills_required=[], education=["master"], role_family="data_science")
    resume = _resume(
        skills=[],
        education=["bachelor"],
        education_fields=["computer science"],
    )
    # 50 (one level below) + 15 bonus = 65
    assert compute_education_score(jd, resume) == 65


# ---------------------------------------------------------------------------
# Scenario fixtures — final score range checks
# (These test the pure helpers in combination, not the async pipeline)
# ---------------------------------------------------------------------------


def _compute_final(
    skills: int,
    exp: int | None,
    edu: int | None,
    role_family: str = "engineering",
    resume_role_families: list[str] | None = None,
) -> int:
    weights = {
        "engineering": (0.50, 0.35, 0.15),
        "data_science": (0.45, 0.30, 0.25),
        "management": (0.25, 0.55, 0.20),
        "research": (0.35, 0.30, 0.35),
        "sales": (0.25, 0.55, 0.20),
        "design": (0.50, 0.35, 0.15),
        "other": (0.45, 0.35, 0.20),
    }
    jd = _jd(skills_required=["python"] * 10, role_family=role_family)
    resume = _resume(skills=[], role_families=resume_role_families or [role_family])
    w = weights.get(role_family, weights["other"])
    base = blend_scores({"skills": skills, "experience": exp, "education": edu}, w)
    result = round(base * relevance_multiplier(skills) * role_mismatch_penalty(jd, resume, skills))
    return min(100, max(0, result))


def test_chef_to_ai_engineer() -> None:
    # skills=0, exp=100, edu=100 but wrong domain
    score = _compute_final(0, 100, 100, role_family="data_science", resume_role_families=["other"])
    assert 10 <= score <= 20, f"Expected 10-20, got {score}"


def test_pm_to_ai_engineer_no_exp_req() -> None:
    # skills=5, exp=None (dropped), edu=100
    score = _compute_final(
        5, None, 100, role_family="data_science", resume_role_families=["management"]
    )
    assert 5 <= score <= 20, f"Expected 5-20, got {score}"


def test_fresh_grad_no_role_family() -> None:
    # skills=80, exp=60, edu=100, no role family detected
    score = _compute_final(80, 60, 100, role_family="engineering", resume_role_families=[])
    assert 75 <= score <= 88, f"Expected 75-88, got {score}"


def test_junior_to_senior_dev() -> None:
    score = _compute_final(85, 40, 100, role_family="engineering")
    assert 65 <= score <= 78, f"Expected 65-78, got {score}"


def test_senior_to_senior_perfect() -> None:
    score = _compute_final(90, 100, 100, role_family="engineering")
    assert 88 <= score <= 95, f"Expected 88-95, got {score}"


def test_ai_to_ai_one_skill_missing() -> None:
    score = _compute_final(75, 100, 100, role_family="data_science")
    assert 80 <= score <= 90, f"Expected 80-90, got {score}"


def test_bootcamp_career_switcher() -> None:
    score = _compute_final(60, 20, 50, role_family="engineering")
    assert 38 <= score <= 52, f"Expected 38-52, got {score}"
