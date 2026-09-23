from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from typing import Any


def _first(value: Any) -> Any:
    return value[0] if isinstance(value, list) and value else None


def _identifier(value: Any) -> Any:
    if isinstance(value, dict):
        return value.get("id") or value.get("uuid") or value.get("value")
    return value


def _split_name(value: Any) -> tuple[str, str]:
    parts = str(value or "").strip().split(None, 1)
    if not parts:
        return "", ""
    return parts[0], parts[1] if len(parts) > 1 else ""


def _as_records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _label(value: Any) -> Any:
    if isinstance(value, dict):
        return value.get("label") or value.get("name") or value.get("title") or value.get("value")
    return value


def _record_id(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = _identifier(record.get(key))
        if value not in (None, ""):
            return value
    return None


def _contact_value(record: dict[str, Any], direct: tuple[str, ...], lists: tuple[str, ...]) -> Any:
    for key in direct:
        value = record.get(key)
        if value not in (None, ""):
            return _label(value)
    for key in lists:
        values = record.get(key)
        if not isinstance(values, list):
            continue
        records = [item for item in values if isinstance(item, dict)]
        primary = next(
            (
                item
                for item in records
                if item.get("isPrimary") is True or item.get("primary") is True
            ),
            records[0] if records else None,
        )
        if primary:
            value = (
                primary.get("value")
                or primary.get("address")
                or primary.get("email")
                or primary.get("number")
                or primary.get("phone")
            )
            if value not in (None, ""):
                return value
    return None


def _email_value(value: Any) -> str | None:
    if isinstance(value, list):
        return _email_value(_first(value))
    if isinstance(value, dict):
        value = value.get("email") or value.get("address") or value.get("value")
    return str(value).strip() if value not in (None, "") else None


def _message_identity(
    provider: str,
    kind: str,
    raw: dict[str, Any],
    candidate_id: str,
    sequence: int = 0,
) -> str:
    identifier = _record_id(
        raw,
        "id",
        "uuid",
        "message_id",
        "messageId",
        "external_id",
        "externalId",
    )
    if identifier not in (None, ""):
        return f"{kind}:{identifier}"
    signature = "|".join(
        str(raw.get(key) or "")
        for key in ("created_at", "createdAt", "timestamp", "subject", "body", "text", "content")
    )
    digest = sha256(f"{provider}|{kind}|{candidate_id}|{sequence}|{signature}".encode()).hexdigest()
    return f"{kind}:{digest[:40]}"


def _canonical_message(
    provider: str,
    raw: dict[str, Any],
    candidate_id: Any,
    *,
    kind: str,
    sequence: int = 0,
    direction: str | None = None,
    candidate_email: str | None = None,
) -> dict[str, Any] | None:
    if candidate_id in (None, ""):
        return None
    external_candidate_id = str(candidate_id)
    user = raw.get("user") if isinstance(raw.get("user"), dict) else {}
    sender = _email_value(
        raw.get("from")
        or raw.get("from_email")
        or raw.get("sender_email")
        or raw.get("sender")
        or user.get("email")
    )
    recipient = _email_value(
        raw.get("to") or raw.get("to_email") or raw.get("recipient_email") or raw.get("recipient")
    )
    resolved_direction = direction or raw.get("direction") or raw.get("type")
    if (
        not direction
        and candidate_email
        and sender
        and sender.casefold() == candidate_email.casefold()
    ):
        resolved_direction = "inbound"
    body = raw.get("body") or raw.get("text") or raw.get("content") or raw.get("value") or ""
    if not isinstance(body, str):
        body = str(body)
    html_body = raw.get("html_body") or raw.get("htmlBody") or raw.get("body_html")
    sent_at = (
        raw.get("created_at")
        or raw.get("createdAt")
        or raw.get("sent_at")
        or raw.get("sentAt")
        or raw.get("timestamp")
        or raw.get("completedAt")
        or raw.get("updated_at")
    )
    if not body.strip() or sent_at in (None, ""):
        return None
    headers = raw.get("headers") if isinstance(raw.get("headers"), dict) else {}
    return {
        "provider_message_id": _message_identity(
            provider, kind, raw, external_candidate_id, sequence
        ),
        "external_candidate_id": external_candidate_id,
        "direction": resolved_direction,
        "sender_email": sender,
        "recipient_email": recipient,
        "subject": raw.get("subject") or raw.get("title") or raw.get("action"),
        "body_text": body,
        "body_html": html_body,
        "sent_at": sent_at,
        "email_message_id": raw.get("email_message_id")
        or raw.get("emailMessageId")
        or raw.get("rfc822_message_id")
        or headers.get("Message-ID")
        or headers.get("message-id"),
        "in_reply_to": raw.get("in_reply_to")
        or raw.get("inReplyTo")
        or headers.get("In-Reply-To")
        or headers.get("in-reply-to"),
        "references_header": raw.get("references")
        or raw.get("References")
        or headers.get("References")
        or headers.get("references"),
    }


def _append_message(target: list[dict[str, Any]], message: dict[str, Any] | None) -> None:
    if message and message["provider_message_id"] not in {
        existing["provider_message_id"] for existing in target
    }:
        target.append(message)


def _messages_from_note(
    provider: str,
    raw: dict[str, Any],
    candidate_id: Any,
    *,
    candidate_email: str | None = None,
) -> list[dict[str, Any]]:
    fields = _as_records(raw.get("fields"))
    comments = fields or [raw]
    messages: list[dict[str, Any]] = []
    for index, comment in enumerate(comments):
        message = _canonical_message(
            provider,
            {
                **raw,
                **comment,
                "id": f"{raw.get('id') or raw.get('uuid') or 'note'}:{index}",
                "body": comment.get("value")
                or comment.get("body")
                or raw.get("content")
                or raw.get("body"),
                "created_at": comment.get("createdAt")
                or comment.get("created_at")
                or raw.get("createdAt")
                or raw.get("created_at")
                or raw.get("completedAt"),
                "subject": raw.get("text") or raw.get("subject") or "Recruiter note",
            },
            candidate_id,
            kind="note",
            sequence=index,
            direction="outbound",
            candidate_email=candidate_email,
        )
        _append_message(messages, message)
    return messages


def _ashby_stage(application: dict[str, Any]) -> tuple[Any, str]:
    stage = (
        application.get("currentInterviewStage")
        or application.get("current_interview_stage")
        or application.get("interviewStage")
        or application.get("interview_stage")
        or application.get("stage")
    )
    stage_id = (
        _identifier(stage)
        or application.get("interviewStageId")
        or application.get("interview_stage_id")
    )
    stage_name = str(_label(stage) or application.get("stageName") or "Applied")
    return stage_id, stage_name


def _ashby_resume_records(candidate: dict[str, Any], candidate_id: str) -> list[dict[str, Any]]:
    attachments: list[dict[str, Any]] = []
    for key in ("resume", "resumeFile", "resume_file"):
        value = candidate.get(key)
        if isinstance(value, dict):
            attachments.append(value)
    for key in ("files", "attachments", "resumes", "candidateFiles"):
        attachments.extend(_as_records(candidate.get(key)))

    resumes: list[dict[str, Any]] = []
    for index, attachment in enumerate(attachments, start=1):
        url = (
            attachment.get("url")
            or attachment.get("downloadUrl")
            or attachment.get("download_url")
            or attachment.get("signedUrl")
        )
        if not url:
            continue
        filename = attachment.get("filename") or attachment.get("name") or "resume"
        file_type = str(attachment.get("type") or attachment.get("category") or "").lower()
        if attachments and "resume" not in file_type and "resume" not in str(filename).lower():
            continue
        resumes.append(
            {
                "external_document_id": str(
                    attachment.get("id")
                    or attachment.get("fileId")
                    or f"{candidate_id}:resume:{index}"
                ),
                "external_candidate_id": candidate_id,
                "source_url": str(url),
                "filename": str(filename),
                "mime_type": attachment.get("contentType") or attachment.get("content_type"),
            }
        )
    return resumes


def _adapt_ashby(bundle: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    jobs: dict[str, dict[str, Any]] = {}
    stages: dict[tuple[str, str], dict[str, Any]] = {}
    candidates: dict[str, dict[str, Any]] = {}
    applications: dict[str, dict[str, Any]] = {}
    resumes: dict[str, dict[str, Any]] = {}

    for raw in bundle.get("job", []):
        job_id = _record_id(raw, "id", "jobId", "job_id")
        title = _label(raw.get("title") or raw.get("name"))
        if job_id is None or not title:
            raise ValueError("Ashby job is missing its ID or title; import stopped")
        job_key = str(job_id)
        jobs[job_key] = {
            "external_job_id": job_key,
            "title": str(title),
            "description": raw.get("description") or raw.get("descriptionHtml"),
        }
        interview_plan = raw.get("interviewPlan") or raw.get("interview_plan") or {}
        plan_stages = interview_plan.get("stages", []) if isinstance(interview_plan, dict) else []
        plan_stages = plan_stages or raw.get("interviewStages") or raw.get("stages") or []
        for position, stage in enumerate(_as_records(plan_stages), start=1):
            stage_id = _record_id(stage, "id", "stageId", "stage_id")
            stage_name = _label(stage.get("name") or stage.get("title"))
            if stage_id is None or not stage_name:
                raise ValueError("Ashby interview stage is missing its ID or name; import stopped")
            stages[(job_key, str(stage_id))] = {
                "external_stage_id": str(stage_id),
                "external_job_id": job_key,
                "name": str(stage_name),
                "position": stage.get("position") or stage.get("order") or position,
            }

    raw_candidates: dict[str, dict[str, Any]] = {}
    for raw in bundle.get("candidate", []):
        candidate_id = _record_id(raw, "id", "candidateId", "candidate_id")
        if candidate_id is None:
            raise ValueError("Ashby candidate is missing its ID; import stopped")
        raw_candidates[str(candidate_id)] = raw

    for raw in bundle.get("application", []):
        application_id = _record_id(raw, "id", "applicationId", "application_id")
        candidate_value = raw.get("candidate")
        job_value = raw.get("job")
        candidate_id = (
            _identifier(candidate_value) or raw.get("candidateId") or raw.get("candidate_id")
        )
        job_id = _identifier(job_value) or raw.get("jobId") or raw.get("job_id")
        if candidate_id is None or job_id is None:
            raise ValueError("Ashby application is missing its candidate or job relationship")
        candidate_key = str(candidate_id)
        job_key = str(job_id)
        if isinstance(candidate_value, dict):
            raw_candidates[candidate_key] = {
                **raw_candidates.get(candidate_key, {}),
                **candidate_value,
            }
        if isinstance(job_value, dict) and job_key not in jobs:
            job_title = _label(job_value.get("title") or job_value.get("name"))
            if job_title:
                jobs[job_key] = {"external_job_id": job_key, "title": str(job_title)}

        stage_id, stage_name = _ashby_stage(raw)
        stage_key = str(stage_id or f"{job_key}:applied")
        stages.setdefault(
            (job_key, stage_key),
            {
                "external_stage_id": stage_key,
                "external_job_id": job_key,
                "name": stage_name,
                "position": len([key for key in stages if key[0] == job_key]) + 1,
            },
        )
        external_application_id = str(application_id or f"{candidate_key}:{job_key}")
        applications[external_application_id] = {
            "external_application_id": external_application_id,
            "external_candidate_id": candidate_key,
            "external_job_id": job_key,
            "external_stage_id": stage_key,
            "status": raw.get("status") or raw.get("applicationStatus") or stage_name,
        }

    for candidate_id, raw in raw_candidates.items():
        name = raw.get("name") or raw.get("fullName") or raw.get("full_name")
        first_name = raw.get("firstName") or raw.get("first_name")
        last_name = raw.get("lastName") or raw.get("last_name")
        if not first_name and not last_name:
            first_name, last_name = _split_name(name)
        email = _contact_value(
            raw,
            ("email", "primaryEmail", "primary_email"),
            ("emailAddresses", "email_addresses", "emails"),
        )
        phone = _contact_value(
            raw,
            ("phone", "phoneNumber", "primaryPhone", "primary_phone"),
            ("phoneNumbers", "phone_numbers", "phones"),
        )
        candidates[candidate_id] = {
            "external_candidate_id": candidate_id,
            "first_name": str(first_name or ""),
            "last_name": str(last_name or ""),
            "email": email,
            "phone": phone,
            "custom_fields": {
                "ashby": {
                    "source": raw.get("source"),
                    "tags": raw.get("tags") or [],
                }
            },
        }
        for resume in _ashby_resume_records(raw, candidate_id):
            resumes[resume["external_document_id"]] = resume

    return {
        "job": list(jobs.values()),
        "stage": list(stages.values()),
        "candidate": list(candidates.values()),
        "application": list(applications.values()),
        "resume": list(resumes.values()),
    }


def _adapt_lever(bundle: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    adapted = deepcopy(bundle)
    candidates: list[dict[str, Any]] = []
    applications: list[dict[str, Any]] = []
    candidate_jobs: dict[str, str] = {}
    opportunity_candidates: dict[str, str] = {}
    for raw in bundle.get("candidate", []):
        candidate = dict(raw)
        opportunity_id = str(raw.get("id"))
        canonical_candidate_id = str(raw.get("contact") or raw.get("id"))
        candidate["id"] = canonical_candidate_id
        opportunity_candidates[opportunity_id] = canonical_candidate_id
        first_name, last_name = _split_name(raw.get("name"))
        candidate["first_name"] = first_name
        candidate["last_name"] = last_name
        raw_applications = _as_records(raw.get("applications"))
        posting_ids = [
            str(value)
            for value in (_identifier(app.get("posting")) for app in raw_applications)
            if value
        ]
        if not posting_ids:
            posting_ids = [
                str(value)
                for value in (_identifier(item) for item in raw.get("postings", []) or [])
                if value
            ]
        if posting_ids:
            candidate_jobs[opportunity_id] = posting_ids[0]
        candidates.append(candidate)
        for application in raw_applications:
            posting_id = _identifier(application.get("posting"))
            if not posting_id:
                continue
            applications.append(
                {
                    **application,
                    "candidate_id": canonical_candidate_id,
                    "posting": posting_id,
                    "stage_id": raw.get("stage"),
                    "status": "archived" if raw.get("archivedAt") else "active",
                }
            )
        if not raw_applications:
            for posting_id in posting_ids:
                applications.append(
                    {
                        "id": f"{raw.get('id')}:{posting_id}",
                        "candidate_id": canonical_candidate_id,
                        "posting": posting_id,
                        "stage_id": raw.get("stage"),
                        "status": "archived" if raw.get("archivedAt") else "active",
                    }
                )
    adapted["candidate"] = candidates
    if applications:
        adapted["application"] = applications

    for entity in ("resume", "interview", "note"):
        records = []
        for raw in bundle.get(entity, []):
            item = dict(raw)
            candidate_id = str(item.get("candidate_id") or "")
            item["candidate_id"] = opportunity_candidates.get(candidate_id, candidate_id)
            if entity == "interview":
                item.setdefault("job_id", candidate_jobs.get(candidate_id))
                item["date"] = item.get("date") or item.get("start") or item.get("startsAt")
            elif entity == "note" and not item.get("content"):
                fields = _as_records(item.get("fields"))
                item["content"] = "\n".join(
                    str(field.get("value")) for field in fields if field.get("value")
                ) or item.get("text")
            records.append(item)
        adapted[entity] = records
    candidate_emails = {
        str(candidate.get("id")): _email_value(candidate.get("emails"))
        for candidate in candidates
        if candidate.get("id") not in (None, "")
    }
    messages: list[dict[str, Any]] = []
    for raw in bundle.get("message", []):
        candidate_id = str(raw.get("candidate_id") or raw.get("opportunity_id") or "")
        candidate_id = opportunity_candidates.get(candidate_id, candidate_id)
        _append_message(
            messages,
            _canonical_message(
                "lever",
                raw,
                candidate_id,
                kind="email",
                candidate_email=candidate_emails.get(candidate_id),
            ),
        )
    for raw in adapted.get("note", []):
        candidate_id = raw.get("candidate_id")
        for message in _messages_from_note(
            "lever",
            raw,
            candidate_id,
            candidate_email=candidate_emails.get(str(candidate_id)),
        ):
            _append_message(messages, message)
    if messages:
        adapted["message"] = messages
    return adapted


def _adapt_smartrecruiters(
    bundle: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    adapted = deepcopy(bundle)
    candidates: list[dict[str, Any]] = []
    applications: list[dict[str, Any]] = []
    stages: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in bundle.get("candidate", []):
        candidate = dict(raw)
        candidate_id = raw.get("id")
        candidate_jobs = _as_records(raw.get("jobs") or raw.get("applications"))
        if candidate_jobs:
            first_job = candidate_jobs[0]
            job_id = _identifier(first_job.get("job") or first_job.get("jobId"))
            status = first_job.get("status")
            stage_id = _identifier(status)
            stage_name = status.get("name") if isinstance(status, dict) else status
        candidates.append(candidate)
        for position, application in enumerate(candidate_jobs):
            job_id = _identifier(application.get("job") or application.get("jobId"))
            if not job_id:
                continue
            status = application.get("status")
            stage_id = _identifier(status)
            stage_name = status.get("name") if isinstance(status, dict) else status
            application_id = application.get("id") or application.get("applicationId")
            applications.append(
                {
                    **application,
                    "id": application_id or f"{candidate_id}:{job_id}",
                    "candidateId": candidate_id,
                    "jobId": job_id,
                    "status": {"id": stage_id, "name": stage_name or "Applied"},
                }
            )
            if stage_id:
                stages[(str(job_id), str(stage_id))] = {
                    "id": stage_id,
                    "jobId": job_id,
                    "name": stage_name or "Applied",
                    "position": position,
                }
    adapted["candidate"] = candidates
    if applications:
        adapted["application"] = applications
    if stages:
        adapted["stage"] = list(stages.values())
    messages: list[dict[str, Any]] = []
    for raw in bundle.get("message", []):
        _append_message(
            messages,
            _canonical_message(
                "smartrecruiters",
                raw,
                raw.get("candidate_id") or raw.get("candidateId"),
                kind="email",
            ),
        )
    for candidate in candidates:
        candidate_id = candidate.get("id")
        candidate_email = _email_value(candidate.get("email"))
        history = candidate.get("communicationHistory") or candidate.get("activity_history") or {}
        history = history if isinstance(history, dict) else {}
        for key, kind in (("comments", "comment"), ("notes", "note"), ("messages", "email")):
            records = _as_records(candidate.get(key)) + _as_records(history.get(key))
            for index, raw in enumerate(records):
                _append_message(
                    messages,
                    _canonical_message(
                        "smartrecruiters",
                        raw,
                        candidate_id,
                        kind=kind,
                        sequence=index,
                        direction="outbound" if kind in {"comment", "note"} else None,
                        candidate_email=candidate_email,
                    ),
                )
    if messages:
        adapted["message"] = messages
    return adapted


def _adapt_bamboohr(bundle: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    adapted = deepcopy(bundle)
    candidates: list[dict[str, Any]] = []
    applications: list[dict[str, Any]] = []
    jobs: list[dict[str, Any]] = []
    for raw in bundle.get("job", []):
        job = dict(raw)
        if job.get("id") is not None:
            job["id"] = str(job["id"])
        title = _label(job.get("title") or job.get("name") or job.get("jobTitle"))
        if title is not None:
            job["title"] = str(title)
        jobs.append(job)
    for raw in bundle.get("candidate", []):
        applicant = raw.get("applicant") or raw.get("candidate") or {}
        if not isinstance(applicant, dict):
            applicant = {}
        applicant_id = (
            applicant.get("id")
            or raw.get("applicantId")
            or raw.get("applicant_id")
            or raw.get("candidateId")
            or raw.get("id")
        )
        applicant_id = str(applicant_id) if applicant_id is not None else None
        applicant = {
            **applicant,
            "id": applicant_id,
            "firstName": applicant.get("firstName")
            or raw.get("firstName")
            or raw.get("first_name"),
            "lastName": applicant.get("lastName") or raw.get("lastName") or raw.get("last_name"),
            "email": applicant.get("email") or raw.get("email"),
            "phone": applicant.get("phone")
            or applicant.get("phoneNumber")
            or raw.get("phone")
            or raw.get("phoneNumber"),
        }
        job = (
            dict(raw["job"])
            if isinstance(raw.get("job"), dict)
            else {
                "id": raw.get("jobId") or raw.get("job_id"),
                "title": raw.get("jobTitle") or raw.get("job_title"),
            }
        )
        if job.get("id") is not None:
            job["id"] = str(job["id"])
        job_title = _label(job.get("title"))
        if job_title is not None:
            job["title"] = str(job_title)
        status = dict(raw["status"]) if isinstance(raw.get("status"), dict) else raw.get("status")
        if not isinstance(status, dict):
            status = {
                "id": raw.get("applicationStatusId") or raw.get("statusId") or status,
                "name": raw.get("statusName") or status,
            }
        else:
            status["name"] = (
                status.get("name") or status.get("label") or raw.get("statusName") or "Applied"
            )
        if status.get("id") is not None:
            status["id"] = str(status["id"])
        normalized = {**raw, "applicant": applicant, "job": job, "status": status}
        candidates.append(normalized)
        applications.append(normalized)
    adapted["candidate"] = candidates
    adapted["application"] = applications
    adapted["job"] = jobs
    resumes: list[dict[str, Any]] = []
    for raw in applications:
        candidate_id = raw.get("applicant", {}).get("id")
        attachments = raw.get("attachments") or raw.get("documents") or raw.get("resumes") or []
        if isinstance(raw.get("resume"), dict):
            attachments = [raw["resume"], *attachments]
        for attachment in _as_records(attachments):
            url = (
                attachment.get("url")
                or attachment.get("downloadUrl")
                or attachment.get("download_url")
            )
            if not url:
                continue
            resumes.append(
                {
                    **attachment,
                    "id": attachment.get("id") or f"{raw.get('id')}:resume",
                    "candidate_id": candidate_id,
                    "url": url,
                    "filename": attachment.get("filename") or attachment.get("name") or "resume",
                    "content_type": attachment.get("contentType") or attachment.get("content_type"),
                }
            )
    if resumes:
        adapted["resume"] = resumes
    return adapted


def _adapt_greenhouse(
    bundle: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    adapted = deepcopy(bundle)
    applications = {
        str(application.get("id")): application
        for application in adapted.get("application", [])
        if application.get("id") is not None
    }
    current_stages: dict[str, Any] = {}
    for stage in adapted.pop("application_stage", []):
        application_id = _identifier(stage.get("application")) or stage.get("application_id")
        interview_stage_id = _identifier(stage.get("job_interview_stage")) or stage.get(
            "job_interview_stage_id"
        )
        if application_id is None or interview_stage_id is None:
            continue
        if stage.get("current") is True or stage.get("exited_at") is None:
            current_stages[str(application_id)] = interview_stage_id
    for application_id, application in applications.items():
        if application_id in current_stages:
            application["job_interview_stage_id"] = current_stages[application_id]

    for entity in ("resume", "interview", "note"):
        for record in adapted.get(entity, []):
            application_id = _identifier(record.get("application")) or record.get("application_id")
            application = applications.get(str(application_id)) if application_id else None
            if not application:
                continue
            if not record.get("candidate_id"):
                record["candidate_id"] = application.get("candidate_id")
            if not record.get("job_id"):
                record["job_id"] = application.get("job_id")
    candidate_emails = {
        str(candidate.get("id")): _email_value(candidate.get("email_addresses"))
        for candidate in adapted.get("candidate", [])
        if candidate.get("id") not in (None, "")
    }
    messages: list[dict[str, Any]] = []
    for raw in bundle.get("message", []):
        _append_message(
            messages,
            _canonical_message(
                "greenhouse",
                raw,
                raw.get("candidate_id"),
                kind="email",
                candidate_email=candidate_emails.get(str(raw.get("candidate_id"))),
            ),
        )
    for feed in bundle.get("message_activity_feed", []):
        candidate_id = feed.get("candidate_id")
        candidate_email = candidate_emails.get(str(candidate_id))
        feed_type = str(
            feed.get("type") or feed.get("action") or feed.get("event_type") or ""
        ).casefold()
        if feed_type in {"email", "message", "comment", "note"}:
            if feed_type in {"comment", "note"}:
                for message in _messages_from_note(
                    "greenhouse", feed, candidate_id, candidate_email=candidate_email
                ):
                    _append_message(messages, message)
            else:
                _append_message(
                    messages,
                    _canonical_message(
                        "greenhouse",
                        feed,
                        candidate_id,
                        kind=feed_type,
                        candidate_email=candidate_email,
                    ),
                )
        for raw in _as_records(feed.get("emails")):
            _append_message(
                messages,
                _canonical_message(
                    "greenhouse",
                    raw,
                    candidate_id,
                    kind="email",
                    candidate_email=candidate_email,
                ),
            )
        for raw in _as_records(feed.get("notes")):
            for message in _messages_from_note(
                "greenhouse", raw, candidate_id, candidate_email=candidate_email
            ):
                _append_message(messages, message)
        for raw in _as_records(feed.get("activities")):
            if str(raw.get("action") or "").lower() not in {"comment", "message"}:
                continue
            _append_message(
                messages,
                _canonical_message(
                    "greenhouse",
                    raw,
                    candidate_id,
                    kind="activity",
                    candidate_email=candidate_email,
                ),
            )
    for raw in adapted.get("note", []):
        candidate_id = raw.get("candidate_id")
        for message in _messages_from_note(
            "greenhouse",
            raw,
            candidate_id,
            candidate_email=candidate_emails.get(str(candidate_id)),
        ):
            _append_message(messages, message)
    if messages:
        adapted["message"] = messages
    return adapted


def _adapt_workable(bundle: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    adapted = deepcopy(bundle)
    candidate_emails = {
        str(candidate.get("id")): _email_value(candidate.get("email"))
        for candidate in adapted.get("candidate", [])
        if candidate.get("id") not in (None, "")
    }
    messages: list[dict[str, Any]] = []
    for raw in bundle.get("message", []):
        action = str(raw.get("action") or raw.get("type") or "").lower()
        if action and action not in {"comment", "message"}:
            continue
        candidate_id = raw.get("candidate_id") or raw.get("candidateId")
        _append_message(
            messages,
            _canonical_message(
                "workable",
                raw,
                candidate_id,
                kind=action or "activity",
                candidate_email=candidate_emails.get(str(candidate_id)),
            ),
        )
    if messages:
        adapted["message"] = messages
    return adapted


def _adapt_recruiterbox(bundle: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    """Flatten Recruiterbox openings and candidate applications into import rows."""
    adapted = deepcopy(bundle)
    candidates: list[dict[str, Any]] = []
    stages: dict[tuple[str, str], dict[str, Any]] = {}
    applications: list[dict[str, Any]] = []
    resumes: list[dict[str, Any]] = []

    for opening in adapted.get("job", []):
        opening_id = _record_id(opening, "id")
        if opening_id in (None, ""):
            continue
        opening_id = str(opening_id)
        for position, stage in enumerate(_as_records(opening.get("stages"))):
            stage_id = _record_id(stage, "id")
            stage_name = _label(stage.get("name") or stage.get("title"))
            if stage_id in (None, "") or not stage_name:
                continue
            stage_id = str(stage_id)
            stages[(str(opening_id), str(stage_id))] = {
                "id": stage_id,
                "job_id": opening_id,
                "name": str(stage_name),
                "position": stage.get("position", position),
            }

    for raw_candidate in adapted.get("candidate", []):
        candidate = dict(raw_candidate)
        candidate_id = _record_id(candidate, "id")
        if candidate_id in (None, ""):
            continue
        candidate["id"] = str(candidate_id)
        candidate_id = candidate["id"]
        opening = candidate.get("opening") if isinstance(candidate.get("opening"), dict) else {}
        stage = candidate.get("stage") if isinstance(candidate.get("stage"), dict) else {}
        opening_id = candidate.get("opening_id") or opening.get("id")
        stage_id = candidate.get("stage_id") or stage.get("id")
        stage_name = candidate.get("stage_name") or stage.get("name")
        if opening_id is not None:
            candidate["opening_id"] = str(opening_id)
            opening_id = str(opening_id)
        if stage_id is not None:
            candidate["stage_id"] = str(stage_id)
            stage_id = str(stage_id)
        if stage_name:
            candidate["stage_name"] = _label(stage_name)
        candidates.append(candidate)
        if (
            opening_id is not None
            and stage_id is not None
            and (str(opening_id), str(stage_id)) not in stages
        ):
            stages[(str(opening_id), str(stage_id))] = {
                "id": str(stage_id),
                "job_id": opening_id,
                "name": str(_label(stage_name) or stage_id),
                "position": len(stages),
            }

        if opening_id is not None:
            applications.append(
                {
                    "id": f"{candidate_id}:{opening_id}",
                    "candidate_id": candidate_id,
                    "opening_id": opening_id,
                    "stage_id": stage_id,
                    "state": candidate.get("state") or candidate.get("stage_name") or "Applied",
                }
            )

        resume = candidate.get("resume")
        resume_records = (
            _as_records(resume)
            if isinstance(resume, list)
            else [resume]
            if isinstance(resume, dict)
            else []
        )
        if not resume_records and any(
            candidate.get(key) for key in ("file_url", "file_name", "content")
        ):
            resume_records = [candidate]
        for resume_record in resume_records:
            source_url = resume_record.get("file_url") or resume_record.get("url")
            content = resume_record.get("content") or resume_record.get("content_base64")
            if not source_url and not content:
                continue
            resumes.append(
                {
                    **resume_record,
                    "id": resume_record.get("id") or f"{candidate_id}:resume",
                    "candidate_id": candidate_id,
                    "file_url": source_url,
                    "file_name": resume_record.get("file_name")
                    or resume_record.get("filename")
                    or "resume",
                    "content": content,
                }
            )

    adapted["candidate"] = candidates
    if applications:
        adapted["application"] = applications
    if stages:
        adapted["stage"] = list(stages.values())
    if resumes:
        adapted["resume"] = resumes
    return adapted


def adapt_provider_bundle(
    provider: str, bundle: dict[str, list[dict[str, Any]]]
) -> dict[str, list[dict[str, Any]]]:
    """Convert provider-specific nesting into fields consumed by canonical mappings."""
    if provider == "lever":
        return _adapt_lever(bundle)
    if provider == "smartrecruiters":
        return _adapt_smartrecruiters(bundle)
    if provider == "bamboohr":
        return _adapt_bamboohr(bundle)
    if provider == "greenhouse":
        return _adapt_greenhouse(bundle)
    if provider == "workable":
        return _adapt_workable(bundle)
    if provider == "recruiterbox":
        return _adapt_recruiterbox(bundle)
    if provider == "ashby":
        return _adapt_ashby(bundle)
    return bundle
