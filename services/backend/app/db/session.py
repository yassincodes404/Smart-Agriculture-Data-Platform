"""
db/session.py
-------------
SQLAlchemy engine and session factory.

Engine is created lazily on first call to get_engine() so that:
- Test suite can import the whole app without pymysql being installed locally.
- Tests override get_db() via dependency injection, bypassing MySQL entirely.
"""

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# ---------------------------------------------------------------------------
# Connection URL — read from environment (set in .env.backend via Docker)
# ---------------------------------------------------------------------------

DB_USER = os.getenv("MYSQL_USER", "agri_user")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "agri_pass")
DB_HOST = os.getenv("MYSQL_HOST", "mysql")
DB_PORT = os.getenv("MYSQL_PORT", "3306")
DB_NAME = os.getenv("MYSQL_DATABASE", "agriculture")

_default_url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
DATABASE_URL = os.getenv("DATABASE_URL", _default_url)

# ---------------------------------------------------------------------------
# Lazy engine + session factory
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def get_engine():
    """Return (creating if necessary) the SQLAlchemy engine."""
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, echo=False)
    return _engine


def get_session_factory():
    """Return (creating if necessary) the sessionmaker bound to the engine."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


# Keep backward-compatible names used across the codebase
@property
def engine():
    return get_engine()


# SessionLocal is used directly in health.py and conftest — expose lazily
class _LazySessionLocal:
    """Proxy that creates the real SessionLocal on first __call__."""

    def __call__(self, *args, **kwargs):
        return get_session_factory()(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(get_session_factory(), name)


SessionLocal = _LazySessionLocal()