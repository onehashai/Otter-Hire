"""restructure_auth_provider

Restructure auth: add oauth_credentials JSONB, rename auth_provider values, drop google_id columns.

Changes:
- Add oauth_credentials JSONB column to users
- Migrate google_id_hash into oauth_credentials JSON: {"provider": "google", "google_id_hash": "..."}
- Rename auth_provider: local -> email, both -> email,google (google stays google)
- Drop old auth_provider CHECK constraint, add new one
- Drop old uq/ix on google_id_hash
- Drop google_id_hash column
- Drop google_id column
- Create partial functional unique index on oauth_credentials->>'google_id_hash'

Revision ID: c238d064fe75
Revises: be217dffee0c
Create Date: 2026-04-14 06:24:05.733582
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c238d064fe75'
down_revision: Union[str, None] = 'be217dffee0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Add oauth_credentials JSONB column
    op.add_column("users", sa.Column("oauth_credentials", postgresql.JSONB(), nullable=True))

    # 2. Migrate existing google_id_hash into oauth_credentials JSONB
    bind.execute(
        sa.text("""
            UPDATE users
            SET oauth_credentials = jsonb_build_object(
                'provider', 'google',
                'google_id_hash', google_id_hash
            )
            WHERE google_id_hash IS NOT NULL
        """)
    )

    # 3. Drop old auth_provider CHECK constraint BEFORE migrating values
    op.drop_constraint("ck_users_auth_provider", "users", type_="check")

    # 4. Migrate auth_provider values: local -> email, both -> email,google
    bind.execute(sa.text("UPDATE users SET auth_provider = 'email' WHERE auth_provider = 'local'"))
    bind.execute(sa.text("UPDATE users SET auth_provider = 'email,google' WHERE auth_provider = 'both'"))

    # 5. Add new auth_provider CHECK constraint
    op.create_check_constraint(
        "ck_users_auth_provider",
        "users",
        "auth_provider IN ('email', 'google', 'email,google', 'google,email')",
    )

    # 6. Drop old unique constraint and index on google_id_hash
    op.drop_constraint("uq_users_google_id_hash", "users", type_="unique")
    op.drop_index("ix_users_google_id_hash", table_name="users")

    # 7. Drop google_id_hash column
    op.drop_column("users", "google_id_hash")

    # 8. Drop google_id column
    op.drop_column("users", "google_id")

    # 9. Create partial functional unique index on google_id_hash inside oauth_credentials
    bind.execute(
        sa.text("""
            CREATE UNIQUE INDEX uq_users_oauth_google_id_hash
            ON users ((oauth_credentials->>'google_id_hash'))
            WHERE oauth_credentials IS NOT NULL
              AND oauth_credentials->>'google_id_hash' IS NOT NULL
        """)
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Drop new functional index
    bind.execute(sa.text("DROP INDEX IF EXISTS uq_users_oauth_google_id_hash"))

    # Re-add google_id and google_id_hash columns (values will be NULL — no decrypt possible)
    op.add_column("users", sa.Column("google_id", sa.String(), nullable=True))
    op.add_column("users", sa.Column("google_id_hash", sa.String(64), nullable=True))

    # Restore google_id_hash from oauth_credentials
    bind.execute(
        sa.text("""
            UPDATE users
            SET google_id_hash = oauth_credentials->>'google_id_hash'
            WHERE oauth_credentials IS NOT NULL
              AND oauth_credentials->>'google_id_hash' IS NOT NULL
        """)
    )

    # Drop oauth_credentials column
    op.drop_column("users", "oauth_credentials")

    # Revert auth_provider values
    bind.execute(sa.text("UPDATE users SET auth_provider = 'local' WHERE auth_provider = 'email'"))
    bind.execute(sa.text("UPDATE users SET auth_provider = 'both' WHERE auth_provider = 'email,google'"))
    bind.execute(sa.text("UPDATE users SET auth_provider = 'both' WHERE auth_provider = 'google,email'"))

    # Drop new CHECK constraint, add old one back
    op.drop_constraint("ck_users_auth_provider", "users", type_="check")
    op.create_check_constraint(
        "ck_users_auth_provider",
        "users",
        "auth_provider IN ('local', 'google', 'both')",
    )

    # Restore index and unique constraint on google_id_hash
    op.create_unique_constraint("uq_users_google_id_hash", "users", ["google_id_hash"])
    op.create_index("ix_users_google_id_hash", "users", ["google_id_hash"])
