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
app.include_router(pipeline_router, prefix="/api/v1")
app.include_router(lands_router, prefix="/api/v1")
app.include_router(crops_router, prefix="/api/v1")
app.include_router(soil_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(activity_logs_router, prefix="/api/v1")

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
