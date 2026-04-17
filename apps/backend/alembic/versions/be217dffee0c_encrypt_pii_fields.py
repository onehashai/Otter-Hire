"""encrypt_pii_fields

Encrypt google_id in users table and encrypted_credentials in integration_credentials table.

- Adds google_id_hash column (HMAC-SHA256 of plaintext google_id) for DB lookups
- Drops old uq_users_google_id / ix_users_google_id on plaintext column
- Fernet-encrypts all existing google_id values in-place
- Fernet-encrypts all existing encrypted_credentials values in-place
- Adds new uq_users_google_id_hash / ix_users_google_id_hash on hash column

Requires ENCRYPTION_KEY env var to be set before running.

Revision ID: be217dffee0c
Revises: unified_initial
Create Date: 2026-04-14 06:23:20.254668
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'be217dffee0c'
down_revision: Union[str, None] = 'unified_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_key() -> str:
    import os
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY environment variable is not set. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
            "and add it to your .env file before running this migration."
        )
    return key


def upgrade() -> None:
    key = _get_key()
    from app.core.crypto import encrypt_value, hmac_hash

    bind = op.get_bind()

    # ── Part A: users.google_id ──────────────────────────────────────────────

    # 1. Add google_id_hash column (nullable for backfill)
    op.add_column("users", sa.Column("google_id_hash", sa.String(64), nullable=True))

    # 2. Drop old unique constraint and index on plaintext google_id
    op.drop_constraint("uq_users_google_id", "users", type_="unique")
    op.drop_index("ix_users_google_id", table_name="users")

    # 3. Data migration: encrypt google_id and populate google_id_hash
    rows = bind.execute(
        sa.text("SELECT id, google_id FROM users WHERE google_id IS NOT NULL")
    ).fetchall()

    for row in rows:
        user_id = row[0]
        plaintext_gid = row[1]

        # Skip rows already encrypted in a previous partial run (Fernet tokens start with "gAAAAA")
        if plaintext_gid.startswith("gAAAAA"):
            continue

        encrypted = encrypt_value(plaintext_gid, key)
        gid_hash = hmac_hash(plaintext_gid, key)

        bind.execute(
            sa.text("UPDATE users SET google_id = :enc, google_id_hash = :h WHERE id = :id"),
            {"enc": encrypted, "h": gid_hash, "id": str(user_id)},
        )

    # 4. Add new unique constraint and index on the hash column
    op.create_unique_constraint("uq_users_google_id_hash", "users", ["google_id_hash"])
    op.create_index("ix_users_google_id_hash", "users", ["google_id_hash"])

    # ── Part B: integration_credentials.encrypted_credentials ───────────────

    # 5. Encrypt all existing plaintext credentials
    ic_rows = bind.execute(
        sa.text(
            "SELECT id, encrypted_credentials FROM integration_credentials "
            "WHERE encrypted_credentials IS NOT NULL"
        )
    ).fetchall()

    for ic_row in ic_rows:
        cred_id = ic_row[0]
        plaintext_cred = ic_row[1]

        if plaintext_cred.startswith("gAAAAA"):
            continue

        bind.execute(
            sa.text(
                "UPDATE integration_credentials SET encrypted_credentials = :enc WHERE id = :id"
            ),
            {"enc": encrypt_value(plaintext_cred, key), "id": str(cred_id)},
        )


def downgrade() -> None:
    # Removes the hash column and restores the original google_id constraint/index.
    # WARNING: Does NOT decrypt google_id or encrypted_credentials values.
    op.drop_index("ix_users_google_id_hash", table_name="users")
    op.drop_constraint("uq_users_google_id_hash", "users", type_="unique")
    op.drop_column("users", "google_id_hash")

    op.create_index("ix_users_google_id", "users", ["google_id"])
    op.create_unique_constraint("uq_users_google_id", "users", ["google_id"])
