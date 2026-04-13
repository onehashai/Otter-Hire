"""PDF text extraction: PyMuPDF, then OCR when the text layer is thin."""

from __future__ import annotations

import re

import fitz  # PyMuPDF

from . import ocr


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _is_low_text(value: str, threshold: int = 80) -> bool:
    return len(_normalize_whitespace(value)) < threshold


def extract_text_pymupdf(content: bytes) -> str:
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text("text") or "")
        return "\n".join(parts).strip()
    finally:
        doc.close()


def extract_pdf_plain_text(content: bytes) -> tuple[str, list[str]]:
    """Return (text, warnings). Uses PyMuPDF, then OCR if output is still low-text."""
    warnings: list[str] = []
    parsed = extract_text_pymupdf(content)
    if not _is_low_text(parsed):
        return parsed, warnings

    try:
        ocr_text = ocr.ocr_pdf_bytes(content)
        if ocr_text:
            warnings.append("ocr_pdf_used")
            return ocr_text, warnings
    except Exception:
        warnings.append("ocr_pdf_failed")

    return parsed, warnings
