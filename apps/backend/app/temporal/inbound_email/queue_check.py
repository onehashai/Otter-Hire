import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.candidate import Candidate
from app.models.email import InboundEmail


async def check_email_flow():
    async with AsyncSessionLocal() as session:
        print("Checking recent email logs in staging database:")
        emails = (await session.execute(
            select(InboundEmail).order_by(InboundEmail.created_at.desc()).limit(3)
        )).scalars().all()
        for em in emails:
            print(f"  * Log -> Subject: {em.subject} | Status: {em.parse_status} | Candidate ID: {em.parsed_candidate_id}")
        
        print("\nChecking recent candidates in staging database:")
        candidates = (await session.execute(
            select(Candidate).order_by(Candidate.created_at.desc()).limit(3)
        )).scalars().all()
        for cand in candidates:
            print(f"  * Candidate -> Name: {cand.name} | Status: {cand.status} | Email: {cand.email}")

asyncio.run(check_email_flow())
