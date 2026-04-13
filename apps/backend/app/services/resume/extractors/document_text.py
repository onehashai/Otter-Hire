"""Unified entry: resume file bytes → normalized plain text."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.resume.extractors.docx_text import extract_docx_plain_text
from app.services.resume.extractors.pdf_text import extract_pdf_plain_text


@dataclass
class ExtractedDocument:
    text: str
    format: str
    warnings: list[str] = field(default_factory=list)


def extract_plain_text(filename: str, content_type: str, content: bytes) -> str:
    """Backward-compatible API: returns text only."""
    return extract_document(filename, content_type, content).text


def extract_document(filename: str, content_type: str, content: bytes) -> ExtractedDocument:
    lower_name = (filename or "").lower()
    lower_type = (content_type or "").lower()

    if lower_name.endswith(".pdf") or lower_type == "application/pdf":
        text, warnings = extract_pdf_plain_text(content)
        return ExtractedDocument(text=text, format="pdf", warnings=warnings)

    if lower_name.endswith(".docx") or lower_type == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        text, warnings = extract_docx_plain_text(content)
        return ExtractedDocument(text=text, format="docx", warnings=warnings)

    raise ValueError("Unsupported resume format")
