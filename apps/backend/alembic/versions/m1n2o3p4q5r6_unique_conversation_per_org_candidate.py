"""merge duplicate conversations then enforce one row per (org_id, candidate_id)

Revision ID: m1n2o3p4q5r6
Revises: 8b691f499c40
Create Date: 2026-03-26

"""

from typing import Sequence, Union

from alembic import op

revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, Sequence[str], None] = "8b691f499c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Point all messages at the canonical conversation (keeper) per (org_id, candidate_id)
    op.execute(
        """
        WITH w AS (
          SELECT DISTINCT ON (org_id, candidate_id)
            id AS keeper_id,
            org_id,
            candidate_id
          FROM conversations
          ORDER BY
            org_id,
            candidate_id,
            COALESCE(last_message_at, created_at) DESC NULLS LAST,
            created_at DESC
        )
        UPDATE messages m
        SET conversation_id = w.keeper_id
        FROM conversations c
        INNER JOIN w ON w.org_id = c.org_id AND w.candidate_id = c.candidate_id
        WHERE m.conversation_id = c.id AND c.id <> w.keeper_id;
        """
    )
    # 2) Remove duplicate conversation rows
    op.execute(
        """
        WITH w AS (
          SELECT DISTINCT ON (org_id, candidate_id)
            id AS keeper_id,
            org_id,
            candidate_id
          FROM conversations
          ORDER BY
            org_id,
            candidate_id,
            COALESCE(last_message_at, created_at) DESC NULLS LAST,
            created_at DESC
        )
        DELETE FROM conversations c
        USING w
        WHERE c.org_id = w.org_id AND c.candidate_id = w.candidate_id AND c.id <> w.keeper_id;
        """
    )
    # 3) Refresh last_message_at from messages
    op.execute(
        """
        UPDATE conversations conv
        SET last_message_at = sub.max_ca
        FROM (
          SELECT conversation_id, MAX(created_at) AS max_ca
          FROM messages
          GROUP BY conversation_id
        ) sub
        WHERE conv.id = sub.conversation_id
          AND (conv.last_message_at IS DISTINCT FROM sub.max_ca);
        """
    )
    # 4) Replace non-unique index with unique constraint
    op.drop_index("ix_conversations_org_candidate", table_name="conversations")
    op.create_unique_constraint(
        "uq_conversations_org_candidate",
        "conversations",
        ["org_id", "candidate_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_conversations_org_candidate", "conversations", type_="unique")
    op.create_index(
        "ix_conversations_org_candidate",
        "conversations",
        ["org_id", "candidate_id"],
        unique=False,
    )
