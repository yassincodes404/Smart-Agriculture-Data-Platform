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
from fastapi.staticfiles import StaticFiles

# Config
from app.core.config import settings

# Centralized security layer
from app.security import SecurityHeadersMiddleware, RateLimitMiddleware

# Import base so all models are registered with SQLAlchemy metadata
from app.db import base as _models_discovery  # noqa: F401

# Routers
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.climate import router as climate_router
from app.api.ingestion import router as ingestion_router
from app.api.pipeline import router as pipeline_router
from app.api.lands import router as lands_router
from app.api.crops import router as crops_router
from app.api.soil import router as soil_router
from app.api.ai import router as ai_router
from app.api.activity_logs import router as activity_logs_router
from app.api.notifications import router as notifications_router

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
# CORS — configurable origins from settings (restrict in production!)
# ---------------------------------------------------------------------------

# Parse CORS_ORIGINS: empty string = allow all (dev only); else comma-separated list
_cors_origins = [
    o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
] if settings.CORS_ORIGINS.strip() else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# Apply centralized security middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, limit=120, window_seconds=60)  # 120 req/min per IP

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
        from app.models.user import Base, User
        from app.db.session import get_engine
        from sqlalchemy.orm import Session
        
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        
        # Patch the database to ensure Google OAuth can insert users without passwords
        from sqlalchemy import text
        with engine.begin() as conn:
            try:
                conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
            except Exception:
                pass
        
        # Patch invalid admin hashes in the deployed database
        with Session(engine) as session:
            admin1 = session.query(User).filter_by(email="admin1@agri.local").first()
            if admin1 and admin1.password_hash and "qKzzD80tRuD.kciuKhZ6RXo2n.oSu6OsrykBg36eNA" in admin1.password_hash:
                admin1.password_hash = "$5$rounds=535000$0elV25TH6NPgasYc$bSGKFwhqaC7QUWTvVTm2nWLoaDnO5Yi9gSOUSt0aSq0"
                
            admin2 = session.query(User).filter_by(email="admin2@agri.local").first()
            if admin2 and admin2.password_hash and "ActzizWhrAnabV47VuIjX3KsS.Hqs81vlfMSnwQoYUD" in admin2.password_hash:
                admin2.password_hash = "$5$rounds=535000$l4oZXLJrq6SmBbJA$8P1cMnEZLjdP79FdKhfVkn/RFtYqzJ1/moifBCS0jpB"
                
            session.commit()
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
app.include_router(pipeline_router, prefix="/api/v1")
app.include_router(lands_router, prefix="/api/v1")
app.include_router(crops_router, prefix="/api/v1")
app.include_router(soil_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(activity_logs_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Serve React Frontend (Single Page Application)
# ---------------------------------------------------------------------------

import os
from fastapi.responses import FileResponse

# Mount the 'assets' directory so Vite's /assets/... URLs work
assets_path = os.path.join(os.path.dirname(__file__), "..", "static", "assets")
if os.path.exists(assets_path):
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """
    Catch-all route for the React Single Page Application.
    If the requested file exists in the static directory (e.g. vite.svg), serve it.
    Otherwise, serve index.html and let React Router handle the URL.
    """
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    requested_file = os.path.join(static_dir, full_path)
    
    if os.path.isfile(requested_file):
        # Add a reasonably strict CSP for production static assets
        # (no unsafe-eval — requires that your prod build doesn't use eval)
        response = FileResponse(requested_file)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https:; "   # unsafe-inline often still needed for some bundles
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https:; "
            "font-src 'self' https:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "frame-ancestors 'none';"
        )
        return response
    
    index_file = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_file):
        response = FileResponse(index_file)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https:; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https:; "
            "font-src 'self' https:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "frame-ancestors 'none';"
        )
        return response
        
    return {"detail": "Not Found"}
