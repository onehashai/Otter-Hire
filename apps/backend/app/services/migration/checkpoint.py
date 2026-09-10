from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any


class FileCheckpointStore:
    """Local checkpoint store; safe for one worker process and easy to inspect."""

    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, job_id: str) -> Path:
        return self.root / f"{job_id}.json"

    async def read(self, job_id: str) -> dict[str, Any]:
        path = self._path(job_id)
        if not path.exists():
            return {}
        return await asyncio.to_thread(json.loads, path.read_text(encoding="utf-8"))

    async def write(self, job_id: str, value: dict[str, Any]) -> None:
        path = self._path(job_id)
        await asyncio.to_thread(path.write_text, json.dumps(value, indent=2), "utf-8")
