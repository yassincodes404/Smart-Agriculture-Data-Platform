"""
tests/conftest.py
-----------------
Shared test fixtures for all test modules.

Uses SQLite in-memory so tests run WITHOUT Docker / MySQL.

The entire stack is wired together:
  - In-memory SQLite creates all tables via Base.metadata.create_all()
  - The FastAPI get_db() dependency is overridden to use the test session
  - Each test function gets a fresh isolated database state

`DATABASE_URL` is set before importing the app so `SessionLocal()` (used by
BackgroundTasks in land discovery) hits the same engine as fixtures.
"""

import os

os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

import app.db.session as db_session_module

db_session_module._engine = None
db_session_module._SessionLocal = None

from app.db.base import Base  # ensures all models are registered
from app.core.dependencies import get_db
from app.core import security
from app.db.session import get_engine
from app.main import app

# ---------------------------------------------------------------------------
# Test database — shared in-memory SQLite (no Docker / no pymysql required)
# ---------------------------------------------------------------------------

test_engine = get_engine()
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function", autouse=False)
def db_session():
    """
    Provides a fresh SQLite session per test.
    Tables are created before each test and dropped afterwards.
    """
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    FastAPI TestClient with get_db overridden to use the test SQLite session.
    Each test gets a clean database state.
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass  # session lifecycle managed by db_session fixture

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper: create a valid JWT token for a given user_id and role
# ---------------------------------------------------------------------------

def make_token(user_id: int, role: str = "viewer") -> str:
    """Create a valid test JWT token with the given user_id and role."""
    return security.create_access_token(data={"sub": str(user_id)})
