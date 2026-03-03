from __future__ import annotations

from dataclasses import dataclass


@dataclass
class InboundWorkflowInput:
    bucket: str
    key: str
