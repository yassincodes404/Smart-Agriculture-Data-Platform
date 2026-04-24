"""
land_discovery_pipeline.py
--------------------------
Phase 2 async fan-out: geo validation, connectors, CV, ETL, modular inserts.

Runs outside the HTTP request (BackgroundTasks or worker). Uses its own DB session.

Real data fetched at discovery:
  1. Climate snapshot         → land_climate   (Open-Meteo current)
  2. Soil moisture + ET₀      → land_water (ET₀), land_soil (moisture)  (Open-Meteo archive)
"""

import logging

from sqlalchemy.orm import Session

from app.connectors import open_meteo
from app.lands import repository

logger = logging.getLogger(__name__)


def execute(land_id: int, db: Session) -> None:
    """
    Discovery pipeline:
      Step 1 — Climate snapshot (Open-Meteo current)
      Step 2 — Soil moisture + ET₀ (Open-Meteo archive)
      Step 3 — Mark land active
    """
    try:
        land = repository.get_land(db, land_id)
        if land is None:
            logger.warning("discovery skipped: land_id=%s not found", land_id)
            return

        lat = float(land.latitude)
        lon = float(land.longitude)

        # ------------------------------------------------------------------
        # Step 1: Current climate → land_climate
        # ------------------------------------------------------------------
        try:
            snap = open_meteo.fetch_current_land_climate(lat, lon)
            if snap:
                ds = repository.get_or_create_data_source(db, "Open-Meteo")
                repository.insert_land_climate_snapshot(
                    db, land_id,
                    temperature_celsius=snap.get("temperature_celsius"),
                    humidity_pct=snap.get("humidity_pct"),
                    rainfall_mm=snap.get("rainfall_mm"),
                    source_id=int(ds.source_id),
                )
                logger.info("climate snapshot saved land_id=%s", land_id)
        except Exception:
            logger.exception("climate connector failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 2: Soil moisture + ET₀ → land_soil + land_water
        # ------------------------------------------------------------------
        try:
            soil_et0 = open_meteo.fetch_soil_and_et0(lat, lon, days=7)
            if soil_et0:
                ds = repository.get_or_create_data_source(db, "Open-Meteo")
                src_id = int(ds.source_id)

                # Soil moisture → land_soil
                if "soil_moisture_pct" in soil_et0:
                    repository.insert_land_soil_snapshot(
                        db, land_id,
                        moisture_pct=soil_et0["soil_moisture_pct"],
                        source_id=src_id,
                    )
                    logger.info("soil moisture saved land_id=%s  moisture=%.1f%%",
                                land_id, soil_et0["soil_moisture_pct"])

                # ET₀ → land_water as crop_water_requirement_mm proxy
                if "et0_mm_per_day" in soil_et0:
                    repository.insert_land_water_snapshot(
                        db, land_id,
                        crop_water_requirement_mm=soil_et0["et0_mm_per_day"],
                        irrigation_status="unknown",   # will be updated by monitoring
                        source_id=src_id,
                    )
                    logger.info("ET₀ saved land_id=%s  et0=%.2f mm/day",
                                land_id, soil_et0["et0_mm_per_day"])
        except Exception:
            logger.exception("soil/ET₀ connector failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 3: Mark land active
        # ------------------------------------------------------------------
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
