"""PDF text extraction: PyMuPDF, then OCR when the text layer is thin."""

from __future__ import annotations

import io
import logging
import re

import fitz  # PyMuPDF

from . import ocr

logger = logging.getLogger(__name__)

# Threshold below which we try pdfminer as a secondary extractor (multi-column layouts)
_PDFMINER_FALLBACK_THRESHOLD = 500


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


def extract_text_pdfminer(content: bytes) -> str:
    """Secondary extractor using pdfminer.six — better at multi-column layouts."""
    try:
        from pdfminer.high_level import extract_text as _pdfminer_extract

        return (_pdfminer_extract(io.BytesIO(content)) or "").strip()
    except Exception as exc:
        logger.debug("pdfminer extraction failed: %s", exc)
        return ""


def extract_pdf_plain_text(content: bytes) -> tuple[str, list[str]]:
    """Return (text, warnings). Uses PyMuPDF; falls back to pdfminer for
    multi-column layouts and to OCR for image-only PDFs."""
    warnings: list[str] = []
    parsed = extract_text_pymupdf(content)

    # For borderline-text PDFs, try pdfminer and keep whichever yields more content
    if len(_normalize_whitespace(parsed)) < _PDFMINER_FALLBACK_THRESHOLD:
        pdfminer_text = extract_text_pdfminer(content)
        if len(_normalize_whitespace(pdfminer_text)) > len(_normalize_whitespace(parsed)):
            parsed = pdfminer_text
            warnings.append("pdfminer_used")

    # Still low-text → image-only PDF, try OCR
    if _is_low_text(parsed):
        try:
            ocr_text = ocr.ocr_pdf_bytes(content)
            if ocr_text:
                warnings.append("ocr_pdf_used")
                return ocr_text, warnings
        except Exception:
            warnings.append("ocr_pdf_failed")

    return parsed, warnings
