"""Scheduled job entrypoints.

All domain pipeline jobs are registered here.
Each job follows the same pattern:
    1. Open a DB session
    2. Call the pipeline entry-point
    3. Close the session (always, in finally)
"""

import logging

from app.db.session import SessionLocal
from app.pipeline import land_monitoring_pipeline
from app.pipeline.climate_pipeline import run_climate_ingestion
from app.pipeline.water_pipeline import run_water_ingestion
from app.pipeline.crop_pipeline import run_crop_ingestion
from app.pipeline.analytics_pipeline import run_analytics_pipeline

logger = logging.getLogger(__name__)


def _get_db():
    """Create and return a new DB session."""
    return SessionLocal()


def _run_pipeline(name: str, pipeline_fn, *args, **kwargs) -> None:
    """Generic pipeline job wrapper — handles session lifecycle."""
    db = _get_db()
    try:
        result = pipeline_fn(db, *args, **kwargs)
        logger.info(f"[Scheduler] {name} completed: {result}")
    except Exception:
        logger.exception(f"[Scheduler] {name} failed")
        db.rollback()
    finally:
        db.close()


def run_climate_ingestion_job() -> None:
    """Scheduled job: ingest climate data from CSV (daily)."""
    _run_pipeline(
        "Climate Ingestion",
        run_climate_ingestion,
        filename="egypt_governorate_climate_5yr.csv",
        source_system="Scheduler_Climate",
    )


def run_water_ingestion_job() -> None:
    """Scheduled job: ingest water usage data from CSV (monthly)."""
    _run_pipeline(
        "Water Ingestion",
        run_water_ingestion,
        filename="egypt_crop_water_use.csv",
        source_system="Scheduler_Water",
    )


def run_crop_ingestion_job() -> None:
    """Scheduled job: ingest crop production data from CSV (monthly)."""
    _run_pipeline(
        "Crop Ingestion",
        run_crop_ingestion,
        filename="egypt_crop_production.csv",
        source_system="Scheduler_Crop",
    )


def run_analytics_job() -> None:
    """Scheduled job: compute cross-domain KPIs (daily)."""
    _run_pipeline("Analytics", run_analytics_pipeline)


def run_land_monitoring_cycle() -> None:
    """Scheduled job: CV/satellite land monitoring cycle."""
    db = _get_db()
    try:
        land_monitoring_pipeline.run_monitoring_cycle(db)
        logger.info("[Scheduler] Land monitoring cycle completed")
    except Exception:
        logger.exception("scheduled land monitoring cycle failed")
        db.rollback()
    finally:
        db.close()
