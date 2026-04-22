"""End-to-end resume pipeline: file bytes → plain text → sections → canonical profile."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.resume.canonical import PersonalInfo, ResumeProfile
from app.services.resume.extractors.document_text import extract_document
from app.services.resume.heuristics import (
    extract_email,
    extract_location,
    extract_name,
    extract_phone,
    should_replace_name,
)
from app.services.resume.hyperlinks import ResumeHyperlink, extract_best_links
from app.services.resume.llm_extract import extract_personalinfo_llm, extract_resume_profile_llm
from app.services.resume.sections import SectionSegment, detect_sections, sections_to_prompt_hint
from app.services.resume.validation import sanitize_resume_profile


def _sections_to_map(segments: list[SectionSegment]) -> dict[str, str]:
    buckets: dict[str, list[str]] = {}
    for seg in segments:
        buckets.setdefault(seg.key, []).append(seg.body.strip())
    return {k: "\n\n".join(parts) for k, parts in buckets.items() if parts}


def _profile_from_heuristics(text: str, fallback_email: str) -> ResumeProfile:
    email = extract_email(text)
    phone = extract_phone(text)
    name = extract_name(text, email or fallback_email)
    address = extract_location(text)
    return ResumeProfile(
        personal=PersonalInfo(
            full_name=name,
            email=email,
            phone=phone,
            address=address,
        ),
    )


def _merge_hyperlinks(
    profile: ResumeProfile,
    hyperlinks: list[ResumeHyperlink],
    *,
    fallback_email: str,
) -> ResumeProfile:
    profile_links, hyperlink_email = extract_best_links(hyperlinks)
    personal = profile.personal
    valid_personal_email = extract_email(personal.email or "")
    fallback = fallback_email.strip().lower() if "@" in fallback_email else None
    email = valid_personal_email or hyperlink_email or fallback or personal.email
    linkedin_url = personal.linkedin_url or profile_links.get("linkedin")
    github_url = personal.github_url or profile_links.get("github")
    website_url = personal.website_url or profile_links.get("portfolio")
    return profile.model_copy(
        update={
            "personal": personal.model_copy(
                update={
                    "email": email,
                    "linkedin_url": linkedin_url,
                    "github_url": github_url,
                    "website_url": website_url,
                }
            )
        }
    )


def enrich_with_heuristics(
    profile: ResumeProfile,
    text: str,
    fallback_email: str,
) -> ResumeProfile:
    """Keep identity fields heuristic-first; use LLM as enrichment only."""
    heuristic_email = extract_email(text)
    llm_email = extract_email(profile.personal.email or "")
    email = heuristic_email or llm_email

    heuristic_phone = extract_phone(text)
    phone = heuristic_phone or profile.personal.phone

    heuristic_name = extract_name(text, email)
    name = heuristic_name or profile.personal.full_name
    llm_name = profile.personal.full_name
    name_fallback_email = email or fallback_email
    if should_replace_name(name, llm_name, fallback_email=name_fallback_email):
        name = llm_name

    address = profile.personal.address or extract_location(text)

    return profile.model_copy(
        update={
            "personal": profile.personal.model_copy(
                update={
                    "full_name": name or profile.personal.full_name,
                    "email": email or profile.personal.email,
                    "phone": phone or profile.personal.phone,
                    "address": address or profile.personal.address,
                }
            )
        }
    )


@dataclass
class ResumeParseResult:
    text: str
    profile: ResumeProfile
    sections: list[SectionSegment]
    document_warnings: list[str]
    parse_method: str
    hyperlinks: list[ResumeHyperlink] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def run_resume_pipeline(
    filename: str,
    content_type: str,
    content: bytes,
    *,
    fallback_email: str = "",
) -> ResumeParseResult:
    """
    Extract plain text, detect sections, optionally run LLM structured extraction,
    merge regex heuristics, then sanitize to canonical profile.
    """
    warnings: list[str] = []
    extracted = extract_document(filename, content_type, content)
    text = extracted.text or ""
    hyperlinks = extracted.hyperlinks or []
    document_warnings = list(extracted.warnings)
    warnings.extend(document_warnings)

    segments = detect_sections(text)
    section_map = _sections_to_map(segments)
    hints = sections_to_prompt_hint(segments)

    parse_method = "heuristic"
    profile: ResumeProfile | None = None

    llm_result = extract_resume_profile_llm(text, hints)
    if llm_result is not None:
        profile = llm_result.profile
        parse_method = "llm_json"

        # Confidence-gated re-parse: if model flagged low confidence or email is missing,
        # run a cheap targeted call to recover contact fields only
        if llm_result.low_confidence or not (profile.personal.email or "").strip():
            warnings.append("llm_low_confidence_reparse")
            personal_retry = extract_personalinfo_llm(text)
            if personal_retry is not None:
                profile = profile.model_copy(
                    update={
                        "personal": profile.personal.model_copy(
                            update={
                                k: getattr(personal_retry, k) or getattr(profile.personal, k)
                                for k in ("full_name", "email", "phone", "address")
                            }
                        )
                    }
                )
    else:
        warnings.append("llm_skipped_or_failed")

    if profile is None:
        profile = _profile_from_heuristics(text, fallback_email)
        parse_method = "heuristic"
    else:
        profile = enrich_with_heuristics(profile, text, fallback_email)

    profile = _merge_hyperlinks(profile, hyperlinks, fallback_email=fallback_email)

    profile = profile.model_copy(update={"section_map": section_map})
    profile = sanitize_resume_profile(profile)

    return ResumeParseResult(
        text=text,
        profile=profile,
        sections=segments,
        document_warnings=document_warnings,
        parse_method=parse_method,
        hyperlinks=hyperlinks,
        warnings=warnings,
    )
