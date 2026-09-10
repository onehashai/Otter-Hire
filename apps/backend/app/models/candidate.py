from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id"))
    status = Column(String, nullable=False)
    name = Column(String, nullable=False)
    external_candidate_id = Column(String(255), nullable=True, index=True)
    email = Column(String, nullable=False)
    phone = Column(String)
    address = Column(String)
    profile_links = Column(JSONB)
    parsed_resume = Column(JSONB)
    source = Column(String)
    tags = Column(JSONB)
    is_pending_duplicate_review = Column(
        Boolean, nullable=False, server_default="false", default=False
    )
    possible_duplicate_of_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    possible_duplicate_of = relationship("Candidate", remote_side=[id])

    __table_args__ = (
        CheckConstraint("status IN ('active', 'rejected', 'hired')", name="ck_candidates_status"),
        Index("ix_candidates_org_job", "org_id", "job_id"),
        Index("ix_candidates_org_stage", "org_id", "stage_id"),
        Index("ix_candidates_org_email", "org_id", "email"),
    )

    organization = relationship("Organization")
    job = relationship("Job")
    stage = relationship("Stage")
    job_assignments = relationship(
        "CandidateJobs",
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
