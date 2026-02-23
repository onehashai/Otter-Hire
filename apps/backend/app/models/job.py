from sqlalchemy import Column, String, DateTime, ForeignKey, Index, CheckConstraint, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.utils.uuid import uuid7
from app.db.base import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    department = Column(String(50))
    employment_type = Column(String(20), server_default="full_time")
    workplace_type = Column(String(10), server_default="remote")
    country = Column(String(2))
    city = Column(String(255))
    openings = Column(Integer, nullable=False, server_default="1")
    salary_type = Column(String(10), nullable=False, server_default="hidden")
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    salary_fixed = Column(Integer)
    currency = Column(String(3), server_default="USD")
    salary_timeframe = Column(String(10), server_default="per_year")
    status = Column(String(10), nullable=False, server_default="draft")
    visibility = Column(String(20), nullable=False, server_default="internal")
    collect_resume = Column(Boolean, nullable=False, server_default="true")
    collect_cover = Column(Boolean, nullable=False, server_default="false")
    screening_questions = Column(JSONB, server_default="[]")
    pipeline_template = Column(String(20), server_default="standard")
    published_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'open', 'archived')", name="ck_jobs_status"),
        CheckConstraint("visibility IN ('internal', 'public')", name="ck_jobs_visibility"),
        CheckConstraint("salary_type IN ('hidden', 'fixed', 'range')", name="ck_jobs_salary_type"),
        CheckConstraint("salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max", name="ck_jobs_salary_range"),
        Index("ix_jobs_org_id", "org_id"),
        Index("ix_jobs_org_status", "org_id", "status"),
    )

    organization = relationship("Organization")
    created_by = relationship("User")
    stages = relationship("Stage", back_populates="job", order_by="Stage.position", cascade="all, delete-orphan")
    team_members = relationship("JobTeamMember", back_populates="job", cascade="all, delete-orphan")
