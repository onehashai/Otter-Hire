from pathlib import Path
from subprocess import CompletedProcess

from app.services.resume.extractors.doc_text import extract_doc_plain_text


def test_extract_doc_plain_text_uses_antiword(monkeypatch) -> None:
    def fake_run(args, **kwargs):
        assert args[0] == "antiword"
        assert Path(args[1]).read_bytes() == b"legacy-word-content"
        assert kwargs["timeout"] == 30
        return CompletedProcess(args=args, returncode=0, stdout=b"Sudha Patidar\n", stderr=b"")

    monkeypatch.setattr(
        "app.services.resume.extractors.doc_text.subprocess.run", fake_run
    )

    assert extract_doc_plain_text(b"legacy-word-content") == "Sudha Patidar"
