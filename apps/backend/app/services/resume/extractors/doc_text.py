"""Legacy Word (.doc) text extraction via the antiword system utility."""

from __future__ import annotations

import subprocess
import tempfile


def extract_doc_plain_text(content: bytes) -> str:
    """Extract text from a binary Word document without trusting its filename."""
    if not content:
        raise ValueError("Word document is empty")

    with tempfile.NamedTemporaryFile(suffix=".doc") as document_file:
        document_file.write(content)
        document_file.flush()
        try:
            result = subprocess.run(
                ["antiword", document_file.name],
                check=False,
                capture_output=True,
                timeout=30,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Legacy Word extraction is unavailable") from exc
        except subprocess.TimeoutExpired as exc:
            raise ValueError("Word document extraction timed out") from exc

    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(detail or "Unable to read Word document")

    return result.stdout.decode("utf-8", errors="replace").strip()
