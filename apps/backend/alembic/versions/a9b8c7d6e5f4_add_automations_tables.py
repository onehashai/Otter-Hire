"""add automations and automation_executions tables

Revision ID: a9b8c7d6e5f4
Revises: c3a9d4b7e1f2
Create Date: 2026-03-16 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a9b8c7d6e5f4"
down_revision: str = "c3a9d4b7e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "automations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
        sa.Column("scope", sa.String(32), nullable=False, server_default="all"),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("trigger_type", sa.String(16), nullable=False),
        sa.Column("trigger_key", sa.String(64), nullable=False),
        sa.Column("trigger_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("condition_logic", sa.String(8), nullable=False, server_default="and"),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("actions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("execution_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_check_constraint(
        "ck_automations_status",
        "automations",
        "status IN ('draft', 'active', 'paused')",
    )
    op.create_check_constraint(
        "ck_automations_scope",
        "automations",
        "scope IN ('all', 'specific_job', 'specific_pipeline')",
    )
    op.create_check_constraint(
        "ck_automations_condition_logic",
        "automations",
        "condition_logic IN ('and', 'or')",
    )
    op.create_index("ix_automations_org_id", "automations", ["org_id"])
    op.create_index("ix_automations_org_status", "automations", ["org_id", "status"])

    op.create_table(
        "automation_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("automation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("automations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_event", sa.String(64), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="success"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_check_constraint(
        "ck_automation_executions_status",
        "automation_executions",
        "status IN ('success', 'failed')",
    )
    op.create_index("ix_automation_executions_org_id", "automation_executions", ["org_id"])
    op.create_index(
        "ix_automation_executions_automation_id",
        "automation_executions",
        ["automation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_automation_executions_automation_id", table_name="automation_executions")
    op.drop_index("ix_automation_executions_org_id", table_name="automation_executions")
    op.drop_constraint("ck_automation_executions_status", "automation_executions", type_="check")
    op.drop_table("automation_executions")

    op.drop_index("ix_automations_org_status", table_name="automations")
    op.drop_index("ix_automations_org_id", table_name="automations")
    op.drop_constraint("ck_automations_condition_logic", "automations", type_="check")
    op.drop_constraint("ck_automations_scope", "automations", type_="check")
    op.drop_constraint("ck_automations_status", "automations", type_="check")
    op.drop_table("automations")

