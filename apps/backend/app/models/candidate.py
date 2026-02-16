from sqlalchemy import Column, String, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id"))
    status = Column(String, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String)
    resume_url = Column(String)
    source = Column(String)
    tags = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('active', 'rejected', 'hired')", name="ck_candidates_status"),
        Index("ix_candidates_org_job", "org_id", "job_id"),
        Index("ix_candidates_org_stage", "org_id", "stage_id"),
        Index("ix_candidates_org_email", "org_id", "email"),
    )

    organization = relationship("Organization")
    job = relationship("Job")
    stage = relationship("Stage")
