from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class CandidateDocument(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True)
    field_key = Column(String(120), nullable=False)
    field_label_snapshot = Column(String(255), nullable=True)
    doc_type = Column(String(50), nullable=False, server_default="custom_field_attachment")
    name = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    object_key = Column(String(2048), nullable=False)
    mime_type = Column(String(120), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    uploaded_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    version = Column(Integer, nullable=False, server_default="1")
    is_deleted = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_documents_org_candidate_created", "org_id", "candidate_id", "created_at"),
        Index("ix_documents_org_job_field", "org_id", "job_id", "field_key"),
        Index("ix_documents_org_uploaded_by", "org_id", "uploaded_by_user_id"),
    )

    organization = relationship("Organization")
    candidate = relationship("Candidate")
    job = relationship("Job")
    uploaded_by = relationship("User")
