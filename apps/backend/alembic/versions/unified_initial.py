"""Full schema from SQLAlchemy models (single baseline).

Creates every mapped table with all columns, primary keys, foreign keys, unique
constraints, check constraints, and indexes exactly as declared under
``app.models`` (loaded via ``import app.models``).

Also seeds the global ``integrations`` catalog with ``email`` and ``linkedin``
rows (idempotent); the app expects these slugs at runtime.

Revision ID: unified_initial
Revises: None
"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op
from app.db.base import Base

revision: str = "unified_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import app.models  # noqa: F401 — register all ORM classes on Base.metadata

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    op.execute(
        text("""
        INSERT INTO integrations (id, name, slug, category, description, is_active, config)
        SELECT gen_random_uuid(), 'Email', 'email', 'email',
               'Inbound email processing via SES and outbound email via SES',
               true, '{}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE slug = 'email')
        """)
    )
    op.execute(
        text("""
        INSERT INTO integrations (id, name, slug, category, description, is_active, config)
        SELECT gen_random_uuid(), 'LinkedIn', 'linkedin', 'job_portal',
               'Post jobs and share content on LinkedIn',
               true, '{}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE slug = 'linkedin')
        """)
    )


def downgrade() -> None:
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
    op.execute(text("DROP TYPE IF EXISTS inbound_parse_status CASCADE"))
