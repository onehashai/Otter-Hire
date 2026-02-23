"""UUID utilities for generating UUIDv7."""
from uuid import UUID as StdUUID
from uuid_utils import uuid7 as _uuid7_gen


def uuid7() -> StdUUID:
    """Generate UUIDv7 compatible with SQLAlchemy and psycopg."""
    # Generate uuid7 and convert to standard UUID via string
    return StdUUID(str(_uuid7_gen()))
