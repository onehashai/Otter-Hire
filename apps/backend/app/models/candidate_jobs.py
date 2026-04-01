from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class CandidateJobs(Base):
    __tablename__ = "Candidate_jobs"

    assigned_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(
        UUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"), nullable=True
    )
    assignment_status = Column(String(32), nullable=False, server_default="active")
    source = Column(String(100), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "assignment_status IN ('active', 'rejected', 'hired', 'withdrawn')",
            name="ck_candidate_jobs_assignment_status",
        ),
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_jobs_candidate_job"),
        Index("ix_candidate_jobs_org_job", "org_id", "job_id"),
        Index("ix_candidate_jobs_org_candidate", "org_id", "candidate_id"),
        Index("ix_candidate_jobs_org_status_updated", "org_id", "assignment_status", "updated_at"),
    )

    organization = relationship("Organization")
    candidate = relationship("Candidate", back_populates="job_assignments")
    job = relationship("Job")
    stage = relationship("Stage")
