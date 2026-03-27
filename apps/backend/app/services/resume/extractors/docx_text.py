"""DOCX text: paragraphs + table cells (python-docx), OCR on embedded images if needed."""

from __future__ import annotations

import re
from io import BytesIO

from docx import Document

from . import ocr


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _is_low_text(value: str, threshold: int = 80) -> bool:
    return len(_normalize_whitespace(value)) < threshold


def _table_lines(document: Document) -> list[str]:
    lines: list[str] = []
    for table in document.tables:
        for row in table.rows:
            cells = [((c.text or "").strip()) for c in row.cells]
            line = " | ".join(c for c in cells if c)
            if line:
                lines.append(line)
    return lines


def extract_docx_plain_text(content: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    document = Document(BytesIO(content))
    lines: list[str] = []
    for p in document.paragraphs:
        t = (p.text or "").strip()
        if t:
            lines.append(t)
    lines.extend(_table_lines(document))
    parsed = "\n".join(lines).strip()

    if _is_low_text(parsed):
        warnings.append("docx_low_text_trying_ocr_images")
        try:
            ocr_text = ocr.ocr_docx_embedded_images(content)
            if ocr_text:
                warnings.append("ocr_docx_images_used")
                return ocr_text, warnings
        except Exception:
            warnings.append("ocr_docx_failed")

    return parsed, warnings
