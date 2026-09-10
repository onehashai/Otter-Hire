from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    external_application_id = Column(String(255), nullable=True, index=True)
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True
    )
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    answers = Column(JSONB, nullable=False, server_default="{}")
    files = Column(JSONB, nullable=True)
    schema_snapshot = Column(JSONB, nullable=False, server_default="{}")
    schema_version = Column(Integer, nullable=False, server_default="1")
    status = Column(String, nullable=False, server_default="submitted")
    applied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'in_review', 'rejected', 'hired')",
            name="ck_job_applications_status",
        ),
        Index("ix_job_applications_org_job_created", "org_id", "job_id", "created_at"),
        Index("ix_job_applications_job_created", "job_id", "created_at"),
        Index("ix_job_applications_org_email", "org_id", "email"),
        Index("ix_job_applications_candidate_created", "candidate_id", "created_at"),
    )
