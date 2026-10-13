"""Backfill Indian candidate phone numbers without changing unrelated profile data."""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import os
import re
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.models.candidate import Candidate
from app.services.resume.heuristics import (
    infer_country_from_context,
    normalize_phone_with_country,
)

logger = logging.getLogger("indian_candidate_phone_backfill")


def _candidate_phone_update(candidate: Candidate) -> str | None:
    profile = candidate.parsed_resume if isinstance(candidate.parsed_resume, dict) else {}
    personal = profile.get("personal") if isinstance(profile.get("personal"), dict) else {}
    stored_phone = candidate.phone
    raw_phone = stored_phone or personal.get("phone")
    if not isinstance(raw_phone, str) or not raw_phone.strip():
        return None

    location = candidate.address or personal.get("address")
    email = candidate.email or personal.get("email")
    text = json.dumps(profile, ensure_ascii=False)
    country = infer_country_from_context(location_str=location, text=text, email=email)
    phone_for_parse = raw_phone.strip()
    if not country:
        return None

    if phone_for_parse.startswith("+"):
        digits = re.sub(r"\D", "", phone_for_parse)
        is_legacy_us_prefix = digits.startswith("1") and len(digits) == 11
        if not is_legacy_us_prefix or country != "IN":
            return None
        phone_for_parse = digits[1:]

    normalized = normalize_phone_with_country(
        phone_for_parse,
        location=location,
        text=text,
        email=email,
    )
    if not normalized:
        return None
    if stored_phone is None or normalized != stored_phone:
        return normalized
    return None


async def _restore_backup(path: Path) -> None:
    restored = skipped = 0
    async with AsyncSessionLocal() as session, session.begin():
        with path.open(newline="", encoding="utf-8") as backup:
            for row in csv.DictReader(backup):
                candidate = await session.scalar(
                    select(Candidate)
                    .where(
                        Candidate.id == UUID(row["candidate_id"]),
                        Candidate.org_id == UUID(row["org_id"]),
                    )
                    .with_for_update()
                )
                if candidate is None or candidate.phone != row["new_phone"]:
                    skipped += 1
                    continue
                candidate.phone = row["old_phone"] or None
                restored += 1
    logger.info("Restore complete; restored=%d skipped_due_to_later_changes=%d", restored, skipped)


async def _restore_unclassified_backup(path: Path) -> None:
    restored = skipped = 0
    async with AsyncSessionLocal() as session, session.begin():
        with path.open(newline="", encoding="utf-8") as backup:
            for row in csv.DictReader(backup):
                candidate = await session.scalar(
                    select(Candidate)
                    .where(
                        Candidate.id == UUID(row["candidate_id"]),
                        Candidate.org_id == UUID(row["org_id"]),
                    )
                    .with_for_update()
                )
                if candidate is None or candidate.phone != row["new_phone"]:
                    skipped += 1
                    continue
                profile = candidate.parsed_resume if isinstance(candidate.parsed_resume, dict) else {}
                personal = profile.get("personal") if isinstance(profile.get("personal"), dict) else {}
                country = infer_country_from_context(
                    location_str=candidate.address or personal.get("address"),
                    text=json.dumps(profile, ensure_ascii=False),
                    email=candidate.email or personal.get("email"),
                )
                if country is not None:
                    skipped += 1
                    continue
                candidate.phone = row["old_phone"] or None
                restored += 1
    logger.info(
        "Unclassified restore complete; restored=%d skipped=%d",
        restored,
        skipped,
    )


async def _backfill(*, apply: bool, backup_path: Path | None) -> None:
    if apply and backup_path is None:
        raise ValueError("--backup-csv is required with --apply")
    candidates_updated = 0
    changes: list[tuple[Candidate, str, str | None]] = []

    async with AsyncSessionLocal() as session:
        statement = select(Candidate).order_by(Candidate.id)
        if apply:
            statement = statement.with_for_update()
        candidates = list((await session.scalars(statement)).all())
        for candidate in candidates:
            normalized = _candidate_phone_update(candidate)
            if normalized is None:
                continue
            changes.append((candidate, candidate.phone, normalized))

        if apply:
            assert backup_path is not None
            descriptor = os.open(backup_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", newline="", encoding="utf-8") as backup:
                writer = csv.writer(backup)
                writer.writerow(("candidate_id", "org_id", "old_phone", "new_phone"))
                for candidate, old_phone, new_phone in changes:
                    writer.writerow((candidate.id, candidate.org_id, old_phone or "", new_phone))
                backup.flush()
                os.fsync(backup.fileno())
            for candidate, _, new_phone in changes:
                candidate.phone = new_phone
            await session.commit()
            candidates_updated = len(changes)
        else:
            await session.rollback()

    logger.info(
        "%s complete; candidates=%d phone_changes=%d%s",
            "Backfill" if apply else "Dry run",
        len(candidates),
        candidates_updated if apply else len(changes),
        f" backup={backup_path}" if apply else "",
    )


async def main(args: argparse.Namespace) -> None:
    try:
        if args.restore_unclassified_backup:
            await _restore_unclassified_backup(args.restore_unclassified_backup)
        elif args.restore_backup:
            await _restore_backup(args.restore_backup)
        else:
            await _backfill(apply=args.apply, backup_path=args.backup_csv)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the phone-only updates")
    parser.add_argument("--backup-csv", type=Path, help="Create a mode-0600 rollback CSV before updates")
    parser.add_argument("--restore-backup", type=Path, help="Restore changes if candidate phone still matches the backfilled value")
    parser.add_argument("--restore-unclassified-backup", type=Path, help="Restore only backup rows that still have no country evidence")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(main(parser.parse_args()))
