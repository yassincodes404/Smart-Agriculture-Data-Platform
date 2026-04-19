"""
land_discovery_pipeline.py
--------------------------
Phase 2 async fan-out: geo validation, connectors, CV, ETL, modular inserts.

Runs outside the HTTP request (BackgroundTasks or worker). Uses its own DB session.
"""

import logging

from sqlalchemy.orm import Session

from app.connectors import open_meteo
from app.lands import repository

logger = logging.getLogger(__name__)


def execute(land_id: int, db: Session) -> None:
    """
    Discovery: fetch a climate snapshot at the land coordinates (Open-Meteo),
    append `land_climate`, then mark the land `active`.
    """
    try:
        land = repository.get_land(db, land_id)
        if land is None:
            logger.warning("discovery skipped: land_id=%s not found", land_id)
            return
        try:
            snap = open_meteo.fetch_current_land_climate(
                float(land.latitude),
                float(land.longitude),
            )
            if snap:
                ds = repository.get_or_create_data_source(db, "Open-Meteo")
                repository.insert_land_climate_snapshot(
                    db,
                    land_id,
                    temperature_celsius=snap.get("temperature_celsius"),
                    humidity_pct=snap.get("humidity_pct"),
                    rainfall_mm=snap.get("rainfall_mm"),
                    source_id=int(ds.source_id),
                )
        except Exception:
            logger.exception("climate connector failed land_id=%s (land still activated)", land_id)
        repository.update_land_status(db, land_id, "active")
        db.commit()
        logger.info("land discovery completed land_id=%s", land_id)
    except Exception:
        logger.exception("land discovery failed land_id=%s", land_id)
        db.rollback()
        raise


def run_in_session(land_id: int) -> None:
    """Entrypoint for FastAPI BackgroundTasks (opens and closes a session)."""
    from app.db.session import SessionLocal

    db: Session = SessionLocal()
    try:
        execute(land_id, db)
    finally:
        db.close()
