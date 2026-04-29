"""ESCO taxonomy loader.

Reads skills_en.csv and builds a Redis hash:
  ats:esco:alias → canonical_skill_name (lowercased, normalized)

Run once on startup or manually:
  python -m app.services.esco_loader
"""

from __future__ import annotations

import csv
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

ESCO_CSV_PATH = Path(__file__).parent.parent.parent / "data" / "esco" / "skills_en.csv"
ESCO_REDIS_PREFIX = "ats:esco:"
ESCO_LOADED_FLAG = "ats:esco:loaded"

_NORMALIZE_RE = re.compile(r"[^a-z0-9\s+/().,-]+")
_SPACE_RE = re.compile(r"\s+")


def _normalize(value: str) -> str:
    lowered = value.lower().strip()
    lowered = _NORMALIZE_RE.sub(" ", lowered)
    return _SPACE_RE.sub(" ", lowered).strip()


def build_esco_map() -> dict[str, str]:
    """Read skills_en.csv and return {normalized_alias: normalized_canonical}."""
    if not ESCO_CSV_PATH.exists():
        logger.warning("ESCO CSV not found at %s", ESCO_CSV_PATH)
        return {}

    alias_map: dict[str, str] = {}
    loaded = 0

    with open(ESCO_CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            skill_type = row.get("skillType", "")
            if not skill_type.startswith("skill"):
                continue

            preferred = _normalize(row.get("preferredLabel", ""))
            if not preferred:
                continue

            # preferred label maps to itself
            alias_map[preferred] = preferred

            # all alt labels map to the preferred label
            alt_labels_raw = row.get("altLabels", "")
            for alt in alt_labels_raw.splitlines():
                alt = _normalize(alt)
                if alt and alt not in alias_map:
                    alias_map[alt] = preferred

            loaded += 1

    logger.info(
        "ESCO: built map with %d canonical skills, %d total aliases", loaded, len(alias_map)
    )
    return alias_map


async def load_esco_into_redis() -> int:
    """Load ESCO alias map into Redis. Returns number of entries loaded."""
    from app.core.redis_client import get_redis_client

    redis = get_redis_client()

    # check if already loaded
    try:
        already = await redis.get(ESCO_LOADED_FLAG)
        if already:
            logger.info("ESCO taxonomy already loaded in Redis, skipping")
            return 0
    except Exception as exc:
        logger.warning("ESCO Redis check failed: %s", exc)
        return 0

    alias_map = build_esco_map()
    if not alias_map:
        return 0

    try:
        # pipeline for bulk insert
        pipe = redis.pipeline()
        for alias, canonical in alias_map.items():
            pipe.set(f"{ESCO_REDIS_PREFIX}{alias}", canonical)
        # set loaded flag — no TTL, permanent
        pipe.set(ESCO_LOADED_FLAG, "1")
        await pipe.execute()
        logger.info("ESCO: loaded %d aliases into Redis", len(alias_map))
        return len(alias_map)
    except Exception as exc:
        logger.warning("ESCO Redis load failed: %s", exc)
        return 0


async def lookup_esco(normalized_skill: str) -> str | None:
    """Look up a normalized skill in ESCO Redis. Returns canonical or None."""
    from app.core.redis_client import get_redis_client

    try:
        result = await get_redis_client().get(f"{ESCO_REDIS_PREFIX}{normalized_skill}")
        return result if result else None
    except Exception as exc:
        logger.warning("ESCO lookup failed: %s", exc)
        return None


if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)
    count = asyncio.run(load_esco_into_redis())
    print(f"Loaded {count} ESCO aliases into Redis")
