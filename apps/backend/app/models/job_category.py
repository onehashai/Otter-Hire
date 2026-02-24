from sqlalchemy import Column, String, DateTime, ForeignKey, Index, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.utils.uuid import uuid7
from app.db.base import Base


class JobCategory(Base):
    __tablename__ = "job_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    is_system_default = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_job_categories_org_name"),
        Index("ix_job_categories_org_id", "org_id"),
    )

    organization = relationship("Organization")
