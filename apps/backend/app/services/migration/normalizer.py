from __future__ import annotations

from typing import Any

from app.schemas.canonical import CanonicalCandidate
from app.services.migration.config_loader import get_path


def normalize_candidate(raw: dict[str, Any], mapping: dict[str, str]) -> CanonicalCandidate:
    values = {field: get_path(raw, source_path) for field, source_path in mapping.items()}
    return CanonicalCandidate.model_validate(values)
