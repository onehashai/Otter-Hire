"""Native MCP record mappings. Missing relationships stay errors, not invented records."""

from __future__ import annotations

from hashlib import sha256
from typing import Any


def _id(value: Any) -> str | None:
    if isinstance(value, dict):
        value = value.get("id")
    return str(value) if value not in (None, "") else None


def _label(value: Any) -> str | None:
    if isinstance(value, dict):
        value = value.get("label") or value.get("name") or value.get("title")
    return str(value) if value not in (None, "") else None


def _records(value: Any) -> list[dict]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _flatten(record: dict) -> dict:
    result = {**(record.get("attributes") or {}), "id": record.get("id")}
    for name, relationship in (record.get("relationships") or {}).items():
        data = relationship.get("data") if isinstance(relationship, dict) else None
        if data is not None:
            result[name] = data
    return result


def _require_id(record: dict, provider: str, entity: str) -> str:
    identifier = _id(record.get("id"))
    if identifier is None:
        raise ValueError(f"{provider} {entity} record has no stable ID; import stopped")
    return identifier


def _candidate(identifier: str, raw: dict, provider: str) -> dict:
    return {
        "external_candidate_id": identifier,
        "first_name": raw.get("first_name") or "",
        "last_name": raw.get("last_name") or "",
        "email": raw.get("email") or None,
        "phone": raw.get("phone") or None,
        "skills": raw.get("skills") or [],
        "custom_fields": {provider: {"source": raw.get("source"), "tags": raw.get("tags")}},
    }


def _resumes(raw: dict, candidate_id: str, application_id: str | None = None) -> list[dict]:
    result = []
    for attachment in _records(raw.get("attachments")):
        kind = str(attachment.get("context") or attachment.get("type") or "").lower()
        if kind not in {"cv", "resume"}:
            continue
        url = attachment.get("url") or attachment.get("downloadUrl")
        filename = attachment.get("name") or attachment.get("filename")
        if not url:
            raise ValueError("MCP resume metadata has no download URL; import stopped")
        # Signed URLs expire, so they must not determine the document identity.
        identity = (
            _id(attachment.get("id"))
            or sha256(
                f"{candidate_id}:{application_id or ''}:{kind}:{filename or ''}".encode()
            ).hexdigest()[:32]
        )
        result.append(
            {
                "external_document_id": identity,
                "external_candidate_id": candidate_id,
                "source_url": url,
                "filename": filename or "resume",
                "mime_type": attachment.get("content_type"),
            }
        )
    return result


def _pinpoint(bundle: dict[str, list[dict]]) -> dict[str, list[dict]]:
    flat = {entity: [_flatten(row) for row in rows] for entity, rows in bundle.items()}
    result: dict[str, list[dict]] = {
        "job": [],
        "candidate": [],
        "application": [],
        "stage": [],
        "resume": [],
    }
    stages = {_require_id(row, "Pinpoint", "stage"): row for row in flat.get("stage", [])}
    stage_jobs: set[tuple[str, str]] = set()
    for job in flat.get("job", []):
        job_id = _require_id(job, "Pinpoint", "job")
        result["job"].append(
            {
                "external_job_id": job_id,
                "title": _label(job.get("title")),
                "description": job.get("description"),
            }
        )
        for stage in _records(job.get("stages")):
            if _id(stage):
                stage_jobs.add((job_id, _id(stage)))
    candidates = {}
    for row in flat.get("candidate", []):
        identifier = _require_id(row, "Pinpoint", "candidate")
        candidates[identifier] = _candidate(identifier, row, "pinpoint")
        result["resume"].extend(_resumes(row, identifier))
    applications = {}
    for row in flat.get("application", []):
        application_id = _require_id(row, "Pinpoint", "application")
        candidate_id = _id(row.get("candidate")) or _id(row.get("candidate_id"))
        job_id = _id(row.get("job")) or _id(row.get("job_id"))
        stage_id = _id(row.get("stage")) or _id(row.get("stage_id"))
        if not candidate_id or not job_id:
            raise ValueError("Pinpoint application is missing its candidate or job relationship")
        if candidate_id not in candidates:
            candidates[candidate_id] = _candidate(candidate_id, row, "pinpoint")
        applications[application_id] = {
            "external_application_id": application_id,
            "external_candidate_id": candidate_id,
            "external_job_id": job_id,
            "external_stage_id": stage_id,
            "applied_at": row.get("created_at"),
            "status": "hired"
            if row.get("hired_at")
            else "rejected"
            if row.get("rejected_at")
            else "submitted",
        }
        if stage_id:
            stage_jobs.add((job_id, stage_id))
        result["resume"].extend(_resumes(row, candidate_id, application_id))
    for job_id, stage_id in sorted(stage_jobs):
        stage = stages.get(stage_id)
        if stage is None:
            raise ValueError("Pinpoint stage relationship was not included in the response")
        result["stage"].append(
            {
                "external_stage_id": stage_id,
                "external_job_id": job_id,
                "name": _label(stage.get("name")),
                "position": stage.get("position"),
            }
        )
    result["candidate"] = list(candidates.values())
    result["application"] = list(applications.values())
    for entity, relationship in (("note", "commentable"), ("interview", "interviewable")):
        if entity not in flat:
            continue
        result[entity] = []
        for row in flat[entity]:
            link = row.get(relationship) or {}
            if not isinstance(link, dict) or link.get("type") != "applications":
                continue  # Job/team comments and talent-pool interviews are not candidate applications.
            application = applications.get(_id(link))
            if application is None:
                raise ValueError(f"Pinpoint {entity} references an unavailable application")
            result[entity].append(
                {
                    f"external_{entity}_id": _require_id(row, "Pinpoint", entity),
                    "external_candidate_id": application["external_candidate_id"],
                    "external_job_id": application["external_job_id"],
                    **(
                        {"content": row.get("body_text")}
                        if entity == "note"
                        else {"scheduled_at": row.get("start_at")}
                    ),
                }
            )
    return result


def _ninehire(bundle: dict[str, list[dict]]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {"job": [], "stage": [], "candidate": [], "application": []}
    candidates = {}
    stages = {}
    for raw in bundle.get("job", []):
        job_id = _id(raw.get("id") or raw.get("recruitmentId"))
        if not job_id:
            raise ValueError("Ninehire recruitment has no stable ID")
        result["job"].append(
            {
                "external_job_id": job_id,
                "title": _label(raw.get("name") or raw.get("title")),
                "description": raw.get("description"),
            }
        )
        for position, stage in enumerate(_records(raw.get("steps")), 1):
            stage_id = _require_id(stage, "Ninehire", "step")
            stages[(job_id, stage_id)] = {
                "external_stage_id": stage_id,
                "external_job_id": job_id,
                "name": _label(stage.get("name")),
                "position": stage.get("position") or position,
            }
    for raw in bundle.get("application", []):
        applicant = raw.get("applicant")
        if not isinstance(applicant, dict):
            raise ValueError("Ninehire applicant progress has no structured applicant details")
        candidate_id = _require_id(applicant, "Ninehire", "applicant")
        job_id = _id(raw.get("recruitment")) or _id(raw.get("recruitmentId"))
        if not job_id:
            raise ValueError("Ninehire applicant progress is missing its recruitment")
        full_name = str(applicant.get("name") or "").split(None, 1)
        candidates[candidate_id] = _candidate(
            candidate_id,
            {
                **applicant,
                "first_name": applicant.get("firstName") or (full_name[0] if full_name else ""),
                "last_name": applicant.get("lastName")
                or (full_name[1] if len(full_name) > 1 else ""),
            },
            "ninehire",
        )
        step = raw.get("step") or {}
        stage_id = _id(step) or _id(raw.get("stepId"))
        if stage_id and (job_id, stage_id) not in stages:
            if not isinstance(step, dict) or not step.get("name"):
                raise ValueError("Ninehire current step has no stage name")
            stages[(job_id, stage_id)] = {
                "external_stage_id": stage_id,
                "external_job_id": job_id,
                "name": _label(step["name"]),
                "position": step.get("position"),
            }
        result["application"].append(
            {
                "external_application_id": _require_id(raw, "Ninehire", "progress"),
                "external_candidate_id": candidate_id,
                "external_job_id": job_id,
                "external_stage_id": stage_id,
                "status": _label(raw.get("status")) or "submitted",
            }
        )
        if "attachments" in applicant:
            result.setdefault("resume", []).extend(_resumes(applicant, candidate_id))
    result["candidate"] = list(candidates.values())
    result["stage"] = list(stages.values())
    return result


def _zoho(bundle: dict[str, list[dict]]) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {"job": [], "candidate": [], "application": [], "stage": []}
    for raw in bundle.get("job", []):
        result["job"].append(
            {
                "external_job_id": _require_id(raw, "Zoho Recruit", "job"),
                "title": _label(raw.get("Posting_Title")),
                "description": raw.get("Job_Description"),
            }
        )
    for raw in bundle.get("candidate", []):
        identifier = _require_id(raw, "Zoho Recruit", "candidate")
        result["candidate"].append(
            _candidate(
                identifier,
                {
                    "first_name": raw.get("First_Name"),
                    "last_name": raw.get("Last_Name"),
                    "email": raw.get("Email"),
                    "phone": raw.get("Mobile") or raw.get("Phone"),
                    "skills": raw.get("Skill_Set"),
                    "source": raw.get("Source"),
                },
                "zoho_recruit",
            )
        )
    stages = {}
    for raw in bundle.get("application", []):
        candidate_id = _id(raw.get("$Candidate_Id")) or (
            _id(raw.get("Candidate_Name")) if isinstance(raw.get("Candidate_Name"), dict) else None
        )
        job_id = _id(raw.get("$Job_Opening_Id")) or (
            _id(raw.get("Job_Opening_Name"))
            if isinstance(raw.get("Job_Opening_Name"), dict)
            else None
        )
        if not candidate_id or not job_id:
            raise ValueError("Zoho Recruit application is missing its candidate or job lookup")
        status = _label(raw.get("Application_Status"))
        stage_id = f"{job_id}:{status}" if status else None
        if stage_id:
            stages[stage_id] = {
                "external_stage_id": stage_id,
                "external_job_id": job_id,
                "name": status,
            }
        result["application"].append(
            {
                "external_application_id": _require_id(raw, "Zoho Recruit", "application"),
                "external_candidate_id": candidate_id,
                "external_job_id": job_id,
                "external_stage_id": stage_id,
                "status": status or "submitted",
                "applied_at": raw.get("Created_Time"),
            }
        )
    result["stage"] = list(stages.values())
    return result


def adapt_mcp_bundle(provider: str, bundle: dict[str, list[dict]]) -> dict[str, list[dict]]:
    mapped = {"pinpoint": _pinpoint, "ninehire": _ninehire, "zoho_recruit": _zoho}[provider](bundle)
    # These are new connectors with no legacy imports. Namespace every foreign key
    # consistently so numeric IDs cannot overwrite another provider's records.
    for rows in mapped.values():
        for row in rows:
            for key, value in list(row.items()):
                if key.startswith("external_") and key.endswith("_id") and value is not None:
                    row[key] = f"{provider}:{value}"
    jobs = {row["external_job_id"] for row in mapped.get("job", [])}
    candidates = {row["external_candidate_id"] for row in mapped.get("candidate", [])}
    for application in mapped.get("application", []):
        if (
            application.get("external_job_id") not in jobs
            or application.get("external_candidate_id") not in candidates
        ):
            raise ValueError(
                f"{provider} application references an unavailable job or candidate; import stopped"
            )
    return mapped
