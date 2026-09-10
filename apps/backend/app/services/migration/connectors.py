from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from datetime import datetime
from typing import Any, Protocol

from app.schemas.canonical import CanonicalCandidate
from app.services.migration.config_loader import ConnectorConfig
from app.services.migration.fetcher import GenericFetcher
from app.services.migration.normalizer import normalize_candidate

RawCandidate = dict[str, Any]


class AtsConnector(Protocol):
    async def fetch_candidates(self, since: datetime | None = None) -> AsyncIterator[RawCandidate]: ...

    def map_to_internal(self, raw: RawCandidate) -> CanonicalCandidate: ...


class ConfiguredConnector:
    def __init__(self, config: ConnectorConfig, secret: str | None = None):
        self.config = config
        self.fetcher = GenericFetcher(config, secret)

    async def fetch_candidates(self, since: datetime | None = None) -> AsyncIterator[RawCandidate]:
        async for record in self.fetcher.records("candidates", since=since.isoformat() if since else None):
            yield record

    def map_to_internal(self, raw: RawCandidate) -> CanonicalCandidate:
        return normalize_candidate(raw, self.config.mappings.get("candidate", {}))


class GreenhouseConnector(ConfiguredConnector):
    """Greenhouse uses the same declarative fetcher with API-key-as-username Basic auth."""


class GenericRestConnector(ConfiguredConnector):
    """Generic REST connector; onboarding requires only a connector JSON config."""


class EmailExportConnector:
    """Adapter for records already extracted from an inbound CSV attachment."""

    def __init__(self, records: list[RawCandidate], mapping: Mapping[str, str]):
        self.records = records
        self.mapping = dict(mapping)

    async def fetch_candidates(self, since: datetime | None = None) -> AsyncIterator[RawCandidate]:
        for record in self.records:
            yield record

    def map_to_internal(self, raw: RawCandidate) -> CanonicalCandidate:
        return normalize_candidate(raw, self.mapping)
