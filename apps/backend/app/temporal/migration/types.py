from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AtsSyncInput:
    integration_id: str
    since: str | None = None


@dataclass
class CommitBatchInput:
    batch_id: str
    actor_id: str
