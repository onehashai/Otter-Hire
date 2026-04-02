"""unify email integration into integration_credentials

Revision ID: p6q7r8s9t0u1
Revises: m1n2o3p4q5r7
Create Date: 2026-04-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p6q7r8s9t0u1"
down_revision: Union[str, Sequence[str], None] = "m1n2o3p4q5r7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    ic_columns = [col['name'] for col in inspector.get_columns('integration_credentials')]
    
    if 'job_id' not in ic_columns:
        op.add_column(
            "integration_credentials", sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True)
        )
    
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_integration_credentials_job_id_jobs') THEN "
        "ALTER TABLE integration_credentials ADD CONSTRAINT fk_integration_credentials_job_id_jobs "
        "FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE; "
        "END IF; END $$"
    )

    op.execute(
        "ALTER TABLE integration_credentials DROP CONSTRAINT IF EXISTS uq_integration_credentials_org_integration"
    )
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_integration_credentials_org_integration_job') THEN "
        "ALTER TABLE integration_credentials ADD CONSTRAINT uq_integration_credentials_org_integration_job "
        "UNIQUE (org_id, integration_id, job_id); "
        "END IF; END $$"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_credentials_org_integration_org_scope "
        "ON integration_credentials (org_id, integration_id) WHERE job_id IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_integration_credentials_integration_org_job "
        "ON integration_credentials (integration_id, org_id, job_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_integration_credentials_inbound_address "
        "ON integration_credentials ((config->>'inbound_address')) WHERE config ? 'inbound_address'"
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
    op.drop_index(
        "ix_integration_credentials_inbound_address", table_name="integration_credentials"
    )
    op.drop_index(
        "ix_integration_credentials_integration_org_job", table_name="integration_credentials"
    )
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
