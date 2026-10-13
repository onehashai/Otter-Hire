"""Reprocess forwarded emails that were incorrectly grouped under a single candidate."""

from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select

from app.db.session import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.document import CandidateDocument
from app.models.email import InboundEmail
from app.temporal.inbound_email.activities import parse_inbound_email_activity
from app.temporal.inbound_email.types import InboundEmailParseInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reprocess_forwarded_candidates")


async def reprocess_forwarded_emails(from_email: str = "justrohit@gmail.com", dry_run: bool = False):
    async with AsyncSessionLocal() as session:
        cutoff = datetime(2026, 10, 6, 0, 0, 0, tzinfo=timezone.utc)
        # Find all inbound emails from today for this sender
        query = (
            select(InboundEmail)
            .where(
                func.lower(InboundEmail.from_email) == from_email.lower(),
                InboundEmail.created_at >= cutoff,
            )
            .order_by(InboundEmail.created_at.asc())
        )
        result = await session.execute(query)
        inbound_emails = result.scalars().all()
        logger.info("Found %d inbound emails from %s to reprocess", len(inbound_emails), from_email)

        # 1. First, remove the mis-assigned document records from candidate 01a0c858-de65-7440-8b7a-c020becf2a26
        target_candidate_id = UUID("01a0c858-de65-7440-8b7a-c020becf2a26")
        if not dry_run:
            del_docs = await session.execute(
                delete(CandidateDocument).where(
                    CandidateDocument.candidate_id == target_candidate_id
                )
            )
            logger.info(
                "Removed %s mis-associated documents from candidate %s",
                del_docs.rowcount,
                target_candidate_id,
            )
            target_cand = await session.scalar(
                select(Candidate).where(Candidate.id == target_candidate_id)
            )
            if target_cand:
                target_cand.name = "Rohit Gadia"
                target_cand.parsed_resume = None
                target_cand.profile_links = {}

            for ie in inbound_emails:
                ie.parsed_candidate_id = None
            await session.commit()

        # 2. Reprocess each inbound email through parse_inbound_email_activity
        for ie in inbound_emails:
            logger.info(
                "Reprocessing email ID=%s Subject=%r Attachment=%s",
                ie.id,
                ie.subject,
                ie.attachment_primary_filename,
            )
            if not dry_run:
                try:
                    res = await parse_inbound_email_activity(
                        InboundEmailParseInput(
                            inbound_email_id=str(ie.id),
                            org_id=str(ie.org_id),
                            force_reprocess=True,
                        )
                    )
                    logger.info("  -> Result: %s", res)
                except Exception as exc:
                    logger.error("  -> Error processing %s: %s", ie.id, exc, exc_info=True)

        # 3. Print final report
        refreshed_result = await session.execute(query)
        refreshed_emails = refreshed_result.scalars().all()
        for ie in refreshed_emails:
            cand = None
            if ie.parsed_candidate_id:
                cand_res = await session.execute(
                    select(Candidate).where(Candidate.id == ie.parsed_candidate_id)
                )
                cand = cand_res.scalar_one_or_none()
            logger.info(
                "Email: %s | Candidate: %s (%s) | Email: %s | Phone: %s",
                ie.subject,
                cand.name if cand else "None",
                ie.parsed_candidate_id,
                cand.email if cand else "None",
                cand.phone if cand else "None",
            )


def main():
    parser = argparse.ArgumentParser(description="Reprocess forwarded candidate emails.")
    parser.add_argument("--from-email", default="justrohit@gmail.com", help="Sender email to reprocess")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without writing")
    args = parser.parse_args()

    asyncio.run(reprocess_forwarded_emails(from_email=args.from_email, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
