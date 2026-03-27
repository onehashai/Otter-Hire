"""Normalize and validate canonical resume profiles."""

from __future__ import annotations

import re

from app.services.resume.canonical import (
    Certification,
    Education,
    HttpUrl,
    PersonalInfo,
    ResumeProfile,
    Skill,
    WorkExperience,
)


def _trim(s: str | None, max_len: int) -> str | None:
    if not s:
        return None
    t = s.strip()
    if not t:
        return None
    return t[:max_len]


def _sanitize_url(url: str | None) -> str | None:
    if not url:
        return None
    u = url.strip()
    if not u:
        return None
    try:
        return str(HttpUrl(u).unicode_string())
    except Exception:
        if re.match(r"^https?://", u, re.I):
            return u[:500]
        return None


def _dedupe_skills(skills: list[Skill], limit: int = 80) -> list[Skill]:
    seen: set[str] = set()
    out: list[Skill] = []
    for s in skills:
        name = (s.name or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            Skill(name=name[:120], category=_trim(s.category, 80))
        )
        if len(out) >= limit:
            break
    return out


def _cap_list(items: list, limit: int) -> list:
    return items[:limit]


def sanitize_resume_profile(profile: ResumeProfile) -> ResumeProfile:
    """Trim lengths, dedupe skills, validate URLs."""
    p = profile.personal
    personal = PersonalInfo(
        full_name=_trim(p.full_name, 120),
        email=_trim(p.email, 254),
        phone=_trim(p.phone, 40),
        address=_trim(p.address, 120),
        headline=_trim(p.headline, 200),
        linkedin_url=_sanitize_url(p.linkedin_url),
        github_url=_sanitize_url(p.github_url),
        website_url=_sanitize_url(p.website_url),
    )

    work: list[WorkExperience] = []
    for w in _cap_list(profile.work_experience, 25):
        highlights = [h.strip() for h in w.highlights if h and h.strip()][:12]
        work.append(
            WorkExperience(
                company=_trim(w.company, 120),
                title=_trim(w.title, 120),
                start_date=_trim(w.start_date, 40),
                end_date=_trim(w.end_date, 40),
                location=_trim(w.location, 120),
                highlights=highlights,
            )
        )

    education = []
    for e in _cap_list(profile.education, 15):
        education.append(
            Education(
                institution=_trim(e.institution, 160),
                degree=_trim(e.degree, 120),
                field=_trim(e.field, 120),
                end_date=_trim(e.end_date, 40),
            )
        )

    certs = []
    for c in _cap_list(profile.certifications, 30):
        if not (c.name or "").strip():
            continue
        certs.append(
            Certification(
                name=(c.name or "").strip()[:160],
                issuer=_trim(c.issuer, 120),
                date=_trim(c.date, 40),
            )
        )

    section_map = {
        k[:80]: v[:8000]
        for k, v in list(profile.section_map.items())[:30]
        if k and v
    }

    return ResumeProfile(
        personal=personal,
        summary=_trim(profile.summary, 8000),
        work_experience=work,
        education=education,
        skills=_dedupe_skills(profile.skills),
        certifications=certs,
        section_map=section_map,
    )
