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
        def update_progress(msg: str):
            from app.models.land import Land
            l = db.get(Land, land_id)
            if l:
                l.status = msg
                db.commit()
                
        land = repository.get_land(db, land_id)
        if land is None:
            logger.warning("discovery skipped: land_id=%s not found", land_id)
            return

        lat = float(land.latitude)
        lon = float(land.longitude)
        
        tracked_vars = land.metadata_.get("trackingVariables") if land.metadata_ else None
        if isinstance(tracked_vars, list) and "ndvi" not in tracked_vars:
            tracked_vars.append("ndvi")
        
        pipeline_errors = []

        # ------------------------------------------------------------------
        # Step 1 & 2: Historical Climate, Soil Moisture, and ET0 Backfill (365 days)
        # ------------------------------------------------------------------
        try:
            update_progress("Step 1/6: Fetching historical climate & soil moisture...")
            records = open_meteo.fetch_historical_climate(lat, lon, days=365)
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
                    if (tracked_vars is None or "climate" in tracked_vars) and ("temperature_max_c" in rec or "rainfall_mm" in rec):
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
                    if (tracked_vars is None or "soil" in tracked_vars) and "soil_moisture_pct" in rec:
                        row_soil = repository.insert_land_soil_snapshot(
                            db, land_id,
                            moisture_pct=rec["soil_moisture_pct"],
                            source_id=src_id,
                        )
                        row_soil.timestamp = ts
                        count_soil += 1
                        
                    # 3. land_water (ET0)
                    if (tracked_vars is None or "water" in tracked_vars) and "et0_mm" in rec:
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
        except Exception as e:
            pipeline_errors.append("climate_data")
            logger.exception("historical climate connector failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 3: High-Res Satellite Visuals (Sentinel-2)
        # ------------------------------------------------------------------
        try:
            update_progress("Step 2/6: Downloading visual Sentinel-2 thumbnails...")
            from app.tasks.sentinel_task import run_sentinel_visual_fetch
            run_sentinel_visual_fetch(land_id, db, update_progress=update_progress)
        except Exception as e:
            pipeline_errors.append("satellite_imagery")
            logger.exception("Sentinel visual task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 4: NDVI history backfill (last 90 days from Planetary Computer)
        # ------------------------------------------------------------------
        # (Removed because run_crop_detection_task now handles time-series backfill directly per zone)

        # ------------------------------------------------------------------
        # Step 5: Static soil profile (ISRIC SoilGrids v2)
        # ------------------------------------------------------------------
        try:
            if tracked_vars is None or "soil" in tracked_vars:
                update_progress("Step 4/6: Fetching soil profile from ISRIC SoilGrids...")
                from app.tasks.soil_task import run_soil_profile_task
                run_soil_profile_task(land_id, db)
            else:
                logger.info("Skipping soil profile task (tracking disabled)")
        except Exception as e:
            pipeline_errors.append("soil_profile")
            logger.exception("soil profile task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 6: Crop Detection & Intelligence (AI-based)
        # ------------------------------------------------------------------
        try:
            if tracked_vars is None or "ndvi" in tracked_vars:
                update_progress("Step 5/6: Running ML multi-crop detection...")
                from app.tasks.crop_task import run_crop_detection_task
                run_crop_detection_task(land_id, db, days=365)
            else:
                logger.info("Skipping crop detection task (tracking disabled)")
        except Exception as e:
            pipeline_errors.append("crop_detection")
            logger.exception("Crop detection task failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 7: AI Land Analysis (Groq — runs if user has API keys)
        # ------------------------------------------------------------------
        try:
            update_progress("Step 6/6: Generating AI insights via Groq Vision...")
            from app.ai.land_analyst import run_ai_land_analysis
            run_ai_land_analysis(land_id, db, user_id=land.user_id)
        except Exception as e:
            pipeline_errors.append("ai_analysis")
            logger.exception("AI analysis failed land_id=%s (continuing)", land_id)

        # ------------------------------------------------------------------
        # Step 8: Finalize Status
        # ------------------------------------------------------------------
        if pipeline_errors:
            logger.error("pipeline errors for land_id=%s: %s. Deleting partially created land.", land_id, pipeline_errors)
            from app.lands.repository import delete_land_cascading
            delete_land_cascading(db, land_id)
            db.commit()
            return

        update_progress("active")
        db.commit()
        logger.info("land discovery completed land_id=%s", land_id)

    except Exception as e:
        logger.exception("land discovery failed land_id=%s", land_id)
        db.rollback()
        try:
            from app.lands.repository import delete_land_cascading
            delete_land_cascading(db, land_id)
            db.commit()
            logger.info("partially created land_id=%s automatically deleted", land_id)
        except Exception:
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
