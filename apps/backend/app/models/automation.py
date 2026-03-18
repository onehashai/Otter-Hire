from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.utils.uuid import uuid7


class Automation(Base):
    __tablename__ = "automations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    status = Column(String(10), nullable=False, server_default="draft")

    scope = Column(String(32), nullable=False, server_default="all")
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    pipeline_id = Column(UUID(as_uuid=True), nullable=True)

    trigger_type = Column(String(16), nullable=False)
    trigger_key = Column(String(64), nullable=False)
    trigger_config = Column(JSONB, nullable=False, server_default="{}")

    condition_logic = Column(String(8), nullable=False, server_default="and")
    conditions = Column(JSONB, nullable=False, server_default="[]")

    actions = Column(JSONB, nullable=False, server_default="[]")

    description = Column(Text)

    last_run_at = Column(DateTime(timezone=True))
    execution_count = Column(Integer, nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'active', 'paused')", name="ck_automations_status"),
        CheckConstraint(
            "scope IN ('all', 'specific_job', 'specific_pipeline')", name="ck_automations_scope"
        ),
        CheckConstraint(
            "condition_logic IN ('and', 'or')", name="ck_automations_condition_logic"
        ),
        Index("ix_automations_org_id", "org_id"),
        Index("ix_automations_org_status", "org_id", "status"),
    )

    organization = relationship("Organization")
    created_by = relationship("User")
    job = relationship("Job")


class AutomationExecution(Base):
    __tablename__ = "automation_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    automation_id = Column(
        UUID(as_uuid=True), ForeignKey("automations.id", ondelete="CASCADE"), nullable=False
    )

    trigger_event = Column(String(64), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)

    status = Column(String(16), nullable=False, server_default="success")
    message = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'failed')",
            name="ck_automation_executions_status",
        ),
        Index("ix_automation_executions_org_id", "org_id"),
        Index("ix_automation_executions_automation_id", "automation_id"),
    )

    automation = relationship("Automation")

