"""unify email integration into integration_credentials

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r7
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "n2o3p4q5r6s7"
down_revision: Union[str, Sequence[str], None] = "m1n2o3p4q5r7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("integration_credentials", sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_integration_credentials_job_id_jobs",
        "integration_credentials",
        "jobs",
        ["job_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "uq_integration_credentials_org_integration",
        "integration_credentials",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_integration_credentials_org_integration_job",
        "integration_credentials",
        ["org_id", "integration_id", "job_id"],
    )
    op.create_index(
        "uq_integration_credentials_org_integration_org_scope",
        "integration_credentials",
        ["org_id", "integration_id"],
        unique=True,
        postgresql_where=sa.text("job_id IS NULL"),
    )
    op.create_index(
        "ix_integration_credentials_integration_org_job",
        "integration_credentials",
        ["integration_id", "org_id", "job_id"],
        unique=False,
    )
    op.create_index(
        "ix_integration_credentials_inbound_address",
        "integration_credentials",
        [sa.text("((config->>'inbound_address'))")],
        unique=False,
        postgresql_where=sa.text("config ? 'inbound_address'"),
    )

    op.execute(
        """
        INSERT INTO integration_credentials (id, org_id, integration_id, job_id, config, status, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            o.id,
            i.id,
            NULL,
            jsonb_strip_nulls(
                jsonb_build_object(
                    'inbound_address', o.inbox_address,
                    'provider', o.inbox_provider,
                    'secret_hash', o.inbox_secret_hash,
                    'verification_status', o.inbox_verification_status,
                    'verified_at', o.inbox_verified_at,
                    'verification_provider', o.inbox_verification_provider,
                    'verification_email_id', o.inbox_verification_email_id
                )
            ),
            o.inbox_status,
            now(),
            now()
        FROM organizations o
        JOIN integrations i ON i.slug = 'email'
        WHERE o.inbox_address IS NOT NULL
        ON CONFLICT (org_id, integration_id) WHERE job_id IS NULL
        DO UPDATE SET
            config = EXCLUDED.config,
            status = EXCLUDED.status,
            updated_at = now()
        """
    )

    op.execute(
        """
        INSERT INTO integration_credentials (id, org_id, integration_id, job_id, config, status, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            j.org_id,
            i.id,
            j.id,
            jsonb_strip_nulls(
                jsonb_build_object(
                    'inbound_address', j.email_inbound_address,
                    'provider', j.email_inbound_provider,
                    'secret_hash', j.email_inbound_secret_hash,
                    'verification_status', j.email_verification_status,
                    'verified_at', j.email_verified_at,
                    'verification_provider', j.email_verification_provider,
                    'verification_email_id', j.email_verification_email_id
                )
            ),
            j.email_inbound_status,
            now(),
            now()
        FROM jobs j
        JOIN integrations i ON i.slug = 'email'
        WHERE j.email_inbound_address IS NOT NULL
        ON CONFLICT (org_id, integration_id, job_id)
        DO UPDATE SET
            config = EXCLUDED.config,
            status = EXCLUDED.status,
            updated_at = now()
        """
    )


def downgrade() -> None:
    op.drop_index("ix_integration_credentials_inbound_address", table_name="integration_credentials")
    op.drop_index("ix_integration_credentials_integration_org_job", table_name="integration_credentials")
    op.drop_index(
        "uq_integration_credentials_org_integration_org_scope",
        table_name="integration_credentials",
    )
    op.drop_constraint(
        "uq_integration_credentials_org_integration_job",
        "integration_credentials",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_integration_credentials_org_integration",
        "integration_credentials",
        ["org_id", "integration_id"],
    )
    op.drop_constraint(
        "fk_integration_credentials_job_id_jobs",
        "integration_credentials",
        type_="foreignkey",
    )
    op.drop_column("integration_credentials", "job_id")
