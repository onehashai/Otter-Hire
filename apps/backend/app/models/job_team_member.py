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


class JobTeamMember(Base):
    __tablename__ = "job_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_job_team_member"),
        CheckConstraint(
            "role IN ('hiring_manager', 'recruiter', 'interviewer', 'coordinator')",
            name="ck_job_team_role",
        ),
        Index("ix_job_team_members_job", "job_id"),
    )

    organization = relationship("Organization")
    job = relationship("Job", back_populates="team_members")
    user = relationship("User")
