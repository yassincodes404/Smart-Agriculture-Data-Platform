"""
main.py
-------
FastAPI application entry point for the Smart Agriculture Data Platform backend.

Startup behaviour:
- Creates all database tables if they don't exist (SQLAlchemy create_all).
- Registers all API routers under /api/v1.
- Configures CORS for React frontend.

All future routers (crops, water, climate …) should be imported and registered here
following the same pattern as auth_router and users_router.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import base so all models are registered with SQLAlchemy metadata
from app.db import base as _models_discovery  # noqa: F401

# Routers
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.climate import router as climate_router
from app.api.ingestion import router as ingestion_router

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Smart Agriculture Data Platform API",
    description="RESTful backend for agricultural data analytics, AI recommendations, and CV processing.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS — allow React frontend (adjust origins for production)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database table auto-creation (development convenience)
# For production: use Alembic migrations instead.
# ---------------------------------------------------------------------------

@app.on_event("startup")
def create_tables() -> None:
    """
    Create all SQLAlchemy-registered tables on startup if they don't exist.

    Silently skips if the database is unreachable (e.g. running tests locally
    without Docker). Tests use their own in-memory SQLite via dependency override.
    """
    try:
        from app.models.user import Base
        from app.db.session import get_engine
        Base.metadata.create_all(bind=get_engine())
    except Exception:
        # DB not available (e.g. local test run without Docker) — safe to ignore.
        pass


# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------

# Existing health routes (no version prefix — keeps /api/health working)
app.include_router(health_router)

# Versioned auth & user management routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(climate_router, prefix="/api/v1")
app.include_router(ingestion_router, prefix="/api/v1")
