"""add external ATS references and source-author fallbacks"""

import sqlalchemy as sa

from alembic import op

revision = "20260909_external_ats_ids"
down_revision = "20260909_seed_more_ats_mcp"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("jobs", sa.Column("external_job_id", sa.String(length=255), nullable=True))
    op.create_index("ix_jobs_external_job_id", "jobs", ["external_job_id"])

    op.add_column("stages", sa.Column("external_stage_id", sa.String(length=255), nullable=True))
    op.create_index("ix_stages_external_stage_id", "stages", ["external_stage_id"])

    op.add_column("candidates", sa.Column("external_candidate_id", sa.String(length=255), nullable=True))
    op.create_index("ix_candidates_external_candidate_id", "candidates", ["external_candidate_id"])

    op.add_column("job_applications", sa.Column("stage_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_job_applications_stage_id_stages",
        "job_applications",
        "stages",
        ["stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("job_applications", sa.Column("external_application_id", sa.String(length=255), nullable=True))
    op.create_index("ix_job_applications_external_application_id", "job_applications", ["external_application_id"])
    op.add_column("job_applications", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("documents", sa.Column("external_document_id", sa.String(length=255), nullable=True))
    op.create_index("ix_documents_external_document_id", "documents", ["external_document_id"])

    op.add_column("interviews", sa.Column("external_interview_id", sa.String(length=255), nullable=True))
    op.create_index("ix_interviews_external_interview_id", "interviews", ["external_interview_id"])
    op.alter_column("interviews", "created_by_user_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("interviews", sa.Column("source_interviewer_name", sa.String(length=255), nullable=True))

    op.add_column("notes", sa.Column("external_note_id", sa.String(length=255), nullable=True))
    op.create_index("ix_notes_external_note_id", "notes", ["external_note_id"])
    op.alter_column("notes", "author_user_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("notes", sa.Column("source_author_name", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("notes", "source_author_name")
    op.alter_column("notes", "author_user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_notes_external_note_id", table_name="notes")
    op.drop_column("notes", "external_note_id")

    op.drop_column("interviews", "source_interviewer_name")
    op.alter_column("interviews", "created_by_user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_index("ix_interviews_external_interview_id", table_name="interviews")
    op.drop_column("interviews", "external_interview_id")

    op.drop_index("ix_documents_external_document_id", table_name="documents")
    op.drop_column("documents", "external_document_id")

    op.drop_column("job_applications", "applied_at")
    op.drop_index("ix_job_applications_external_application_id", table_name="job_applications")
    op.drop_column("job_applications", "external_application_id")
    op.drop_constraint("fk_job_applications_stage_id_stages", "job_applications", type_="foreignkey")
    op.drop_column("job_applications", "stage_id")

    op.drop_index("ix_candidates_external_candidate_id", table_name="candidates")
    op.drop_column("candidates", "external_candidate_id")
    op.drop_index("ix_stages_external_stage_id", table_name="stages")
    op.drop_column("stages", "external_stage_id")
    op.drop_index("ix_jobs_external_job_id", table_name="jobs")
    op.drop_column("jobs", "external_job_id")
