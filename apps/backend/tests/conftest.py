"""
Pytest configuration and shared fixtures.

Provides database session and common test utilities.
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.base import Base

# Test database URL (use Docker postgres or localhost)
# For Docker: use 'localhost' since we're running tests from host
# Database should be created first: docker exec ats-postgres psql -U postgres -c "CREATE DATABASE ats_test_db;"
if "postgresql+psycopg://" in settings.database_url:
    # Already using psycopg (async driver)
    TEST_DATABASE_URL = settings.database_url.replace("/ats_db", "/ats_test_db")
else:
    # Fallback
    TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/ats_test_db"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine():
    """Create test database engine."""
    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )

    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield test_engine

    # Drop all tables after tests
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


@pytest.fixture
async def db(engine) -> AsyncSession:
    """Create database session for each test."""
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        # Clean up database tables in reverse order of dependency
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()

        yield session
        await session.rollback()


@pytest.fixture
def anyio_backend():
    """Use asyncio backend for anyio."""
    return "asyncio"
