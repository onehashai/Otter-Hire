"""OCR fallbacks for low-text PDFs and DOCX with embedded images."""

from __future__ import annotations

import zipfile
from io import BytesIO

import pypdfium2 as pdfium
import pytesseract
from PIL import Image

OCR_MAX_PDF_PAGES = 8
OCR_MAX_DOCX_IMAGES = 8

def ocr_pdf_bytes(pdf_bytes: bytes) -> str:
    text_chunks: list[str] = []
    pdf = pdfium.PdfDocument(pdf_bytes)
    max_pages = min(len(pdf), max(1, OCR_MAX_PDF_PAGES))
    for page_index in range(max_pages):
        page = pdf[page_index]
        pil_image = page.render(scale=2).to_pil()
        ocr_text = pytesseract.image_to_string(pil_image)
        if ocr_text and ocr_text.strip():
            text_chunks.append(ocr_text.strip())
    return "\n".join(text_chunks).strip()


def ocr_docx_embedded_images(docx_bytes: bytes) -> str:
    text_chunks: list[str] = []
    max_images = max(1, OCR_MAX_DOCX_IMAGES)
    with zipfile.ZipFile(BytesIO(docx_bytes)) as archive:
        media_files = [name for name in archive.namelist() if name.startswith("word/media/")]
        for media_name in media_files[:max_images]:
            image_bytes = archive.read(media_name)
            try:
                image = Image.open(BytesIO(image_bytes))
                ocr_text = pytesseract.image_to_string(image)
                if ocr_text and ocr_text.strip():
                    text_chunks.append(ocr_text.strip())
            except Exception:
                continue
    return "\n".join(text_chunks).strip()
