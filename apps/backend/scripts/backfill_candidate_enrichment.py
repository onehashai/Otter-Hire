"""Backfill candidate phone normalization and avatar enrichment in small batches."""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.models.candidate import Candidate
from app.services.avatar_service import enrich_candidate_profile_and_avatar
from app.services.resume.heuristics import normalize_phone_with_country

logger = logging.getLogger("candidate_enrichment_backfill")
_BATCH_SIZE = 100


async def backfill_candidates(*, limit: int | None = None) -> None:
    last_candidate_id = None
    processed = 0
    while limit is None or processed < limit:
        batch_limit = _BATCH_SIZE if limit is None else min(_BATCH_SIZE, limit - processed)
        statement = select(Candidate.org_id, Candidate.id)
        if last_candidate_id is not None:
            statement = statement.where(Candidate.id > last_candidate_id)
        statement = statement.order_by(Candidate.id).limit(batch_limit)
        async with AsyncSessionLocal() as session:
            rows = (await session.execute(statement)).all()
        if not rows:
            break

        for org_id, candidate_id in rows:
            try:
                await enrich_candidate_profile_and_avatar(
                    org_id=org_id,
                    candidate_id=candidate_id,
                    force_avatar_refresh=False,
                )
            except Exception:
                logger.exception("Candidate enrichment failed candidate_id=%s", candidate_id)
            processed += 1
            if processed % 25 == 0:
                logger.info("Processed %d candidates", processed)

        last_candidate_id = rows[-1][1]

    logger.info("Candidate enrichment backfill complete; processed=%d", processed)


async def backfill_candidate_phones(*, limit: int | None = None) -> None:
    last_candidate_id = None
    processed = 0
    updated = 0
    while limit is None or processed < limit:
        batch_limit = _BATCH_SIZE if limit is None else min(_BATCH_SIZE, limit - processed)
        statement = select(Candidate).order_by(Candidate.id).limit(batch_limit)
        if last_candidate_id is not None:
            statement = statement.where(Candidate.id > last_candidate_id)

        async with AsyncSessionLocal() as session:
            candidates = list((await session.scalars(statement)).all())
            if not candidates:
                break

            for candidate in candidates:
                profile = candidate.parsed_resume if isinstance(candidate.parsed_resume, dict) else {}
                personal = profile.get("personal") if isinstance(profile.get("personal"), dict) else {}
                location = candidate.address or personal.get("address")
                stored_phone = candidate.phone
                raw_phone = stored_phone
                if not raw_phone and isinstance(personal.get("phone"), str):
                    raw_phone = personal["phone"].strip()
                if raw_phone and not raw_phone.strip().startswith("+"):
                    normalized = normalize_phone_with_country(raw_phone, location=location)
                    if normalized and (normalized != raw_phone or not stored_phone):
                        candidate.phone = normalized
                        updated += 1
                processed += 1

            last_candidate_id = candidates[-1].id
            await session.commit()
        if processed % _BATCH_SIZE == 0:
            logger.info("Phone backfill processed=%d updated=%d", processed, updated)

    logger.info("Phone backfill complete; processed=%d updated=%d", processed, updated)


async def _main(limit: int | None, *, phones_only: bool = False) -> None:
    try:
        if phones_only:
            await backfill_candidate_phones(limit=limit)
        else:
            await backfill_candidates(limit=limit)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, help="Process at most this many candidates")
    parser.add_argument(
        "--phones-only",
        action="store_true",
        help="Normalize existing phone fields without making avatar-provider requests",
    )
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(_main(arguments.limit, phones_only=arguments.phones_only))
