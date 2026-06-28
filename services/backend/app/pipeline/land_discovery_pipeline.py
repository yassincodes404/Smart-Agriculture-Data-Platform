"""
land_discovery_pipeline.py
--------------------------
Full discovery fan-out: connectors, NDVI backfill, Soil profile, ETL, modular inserts.

Runs outside the HTTP request (BackgroundTasks or worker). Uses its own DB session.

Real data fetched at discovery:
  Step 1. Climate snapshot         → land_climate   (Open-Meteo current)
  Step 2. Soil moisture + ET₀      → land_water, land_soil  (Open-Meteo archive)
  Step 3. NDVI history backfill    → land_crops  (MODIS MOD13Q1, last 90 days)
  Step 4. Static soil profile      → land_soil_profiles  (ISRIC SoilGrids v2)
  Step 5. High-Res Satellite       → land_images  (Sentinel-2 via Planetary Computer)
  Step 6. Mark land active
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
        # Step 1 & 2: Historical Climate, Soil Moisture, and ET0 Backfill (90 days)
        # ------------------------------------------------------------------
        try:
            records = open_meteo.fetch_historical_climate(lat, lon, days=90)
            if records:
                ds = repository.get_or_create_data_source(db, "Open-Meteo")
                src_id = int(ds.source_id)
                from datetime import datetime
                
                count_clim, count_soil, count_water = 0, 0, 0
                for rec in records:
                    date_str = rec.get("date")
                    if not date_str:
                        continue
                    try:
                        ts = datetime.strptime(date_str, "%Y-%m-%d")
                    except ValueError:
                        continue
                    
                    # 1. land_climate
                    if "temperature_max_c" in rec or "rainfall_mm" in rec:
                        # Estimate avg temp if needed, or store max. We use temperature_celsius as max temp proxy for daily.
                        temp = rec.get("temperature_max_c")
                        rain = rec.get("rainfall_mm")
                        hum = rec.get("humidity_pct")
                        row_clim = repository.insert_land_climate_snapshot(
                            db, land_id,
                            temperature_celsius=temp,
                            humidity_pct=hum,
                            rainfall_mm=rain,
                            source_id=src_id,
                        )
                        row_clim.timestamp = ts
                        count_clim += 1

                    # 2. land_soil
                    if "soil_moisture_pct" in rec:
                        row_soil = repository.insert_land_soil_snapshot(
                            db, land_id,
                            moisture_pct=rec["soil_moisture_pct"],
                            source_id=src_id,
                        )
                        row_soil.timestamp = ts
                        count_soil += 1
                        
                    # 3. land_water (ET0)
                    if "et0_mm" in rec:
                        row_water = repository.insert_land_water_snapshot(
                            db, land_id,
                            crop_water_requirement_mm=rec["et0_mm"],
                            irrigation_status="unknown",
                            source_id=src_id,
                        )
                        row_water.timestamp = ts
                        count_water += 1

                logger.info("historical backfill saved land_id=%s climate=%d soil=%d water=%d",
                            land_id, count_clim, count_soil, count_water)
        except Exception:
            logger.exception("historical climate connector failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 3: NDVI history backfill (last 90 days from MODIS MOD13Q1)
        # ------------------------------------------------------------------
        try:
            from app.tasks.satellite_task import run_ndvi_history_backfill
            inserted = run_ndvi_history_backfill(land_id, db, days=90)
            logger.info("NDVI backfill complete land_id=%s  records=%d", land_id, inserted)
        except Exception:
            logger.exception("NDVI backfill failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 4: Static soil profile (ISRIC SoilGrids v2)
        # ------------------------------------------------------------------
        try:
            from app.tasks.soil_task import run_soil_profile_task
            run_soil_profile_task(land_id, db)
        except Exception:
            logger.exception("soil profile task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 5: High-Res Satellite Visuals (Sentinel-2)
        # ------------------------------------------------------------------
        try:
            from app.tasks.sentinel_task import run_sentinel_visual_fetch
            run_sentinel_visual_fetch(land_id, db)
        except Exception:
            logger.exception("Sentinel visual task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 6: Crop Detection & Intelligence (AI-based)
        # ------------------------------------------------------------------
        try:
            from app.tasks.crop_task import run_crop_detection_task
            run_crop_detection_task(land_id, db)
        except Exception:
            logger.exception("Crop detection task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 7: AI Land Analysis (Groq — runs if user has API keys)
        # ------------------------------------------------------------------
        try:
            from app.ai.land_analyst import run_ai_land_analysis
            run_ai_land_analysis(land_id, db, user_id=land.user_id)
        except Exception:
            logger.exception("AI analysis failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 8: Mark land active
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
