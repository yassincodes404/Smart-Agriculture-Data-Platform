"""
tasks/satellite_task.py
-----------------------
Per-land NDVI update orchestrator.

Responsibilities:
  1. Fetch MODIS NDVI data for a land's centroid coordinates
  2. Compute NDVI from raw NIR/RED bands (cv.ndvi)
  3. Classify health, growth stage, trend, confidence
  4. Insert LandCrop snapshot with all fields
  5. Detect anomalies → insert LandAlert if needed
  6. Optionally backfill historical NDVI

This task is called:
  - At land registration (backfill 90 days)
  - By the monitoring pipeline every land.monitoring_interval_days
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.connectors import modis_ndvi
from app.cv import ndvi as ndvi_engine
from app.lands import repository

logger = logging.getLogger(__name__)


def run_ndvi_task(land_id: int, db: Session) -> bool:
    """
    Fetch and store the latest NDVI snapshot for a land.

    Returns True if a new record was inserted, False if no data available.
    """
    land = repository.get_land(db, land_id)
    if land is None:
        logger.warning("ndvi_task skipped: land_id=%s not found", land_id)
        return False

    lat = float(land.latitude)
    lon = float(land.longitude)

    # --- Fetch latest NDVI from MODIS ---
    latest = modis_ndvi.fetch_latest_ndvi(lat, lon)
    if latest is None:
        logger.warning("ndvi_task: no MODIS data for land_id=%s", land_id)
        return False

    # --- Compute NDVI from raw bands (or use pre-computed if bands absent) ---
    nir = latest.get("nir")
    red = latest.get("red")
    ndvi_value = (
        ndvi_engine.compute_ndvi(nir, red)
        if (nir is not None and red is not None)
        else latest.get("ndvi_modis")
    )

    if ndvi_value is None:
        logger.warning("ndvi_task: could not determine NDVI for land_id=%s", land_id)
        return False

    # --- Classification ---
    health = ndvi_engine.classify_health(ndvi_value)
    month = datetime.now(timezone.utc).month
    growth_stage = ndvi_engine.estimate_growth_stage(ndvi_value, month)

    # --- Trend from recent history ---
    recent_crops = repository.list_land_crop_rows(db, land_id, limit=6)
    ndvi_series = [float(r.ndvi_value) for r in recent_crops if r.ndvi_value is not None]
    ndvi_series.append(ndvi_value)
    trend = ndvi_engine.compute_trend(ndvi_series)

    # --- Confidence from quality flag ---
    quality_flag = latest.get("quality_flag")
    confidence = ndvi_engine.compute_confidence(
        [quality_flag] if quality_flag is not None else []
    )

    # --- Insert LandCrop snapshot ---
    ds = repository.get_or_create_data_source(db, "MODIS-MOD13Q1")
    repository.insert_land_crop_snapshot(
        db, land_id,
        ndvi_value=ndvi_value,
        growth_stage=growth_stage,
        ndvi_trend=trend,
        confidence=confidence,
        source_id=int(ds.source_id),
    )

    # --- Anomaly detection ---
    if ndvi_engine.detect_anomaly(ndvi_series):
        repository.insert_land_alert(
            db, land_id,
            alert_type="ndvi_drop",
            severity="high",
            message=f"NDVI dropped significantly to {ndvi_value:.3f} (trend: {trend})",
            payload={
                "ndvi_current": ndvi_value,
                "ndvi_history_mean": round(sum(ndvi_series[:-1]) / max(len(ndvi_series[:-1]), 1), 4),
                "health": health,
            },
        )
        logger.warning("NDVI anomaly detected for land_id=%s  ndvi=%.3f", land_id, ndvi_value)

    db.commit()
    logger.info(
        "ndvi_task complete land_id=%s  ndvi=%.4f  health=%s  stage=%s  trend=%s",
        land_id, ndvi_value, health, growth_stage, trend,
    )
    return True


def run_ndvi_history_backfill(
    land_id: int,
    db: Session,
    days: int = 90,
) -> int:
    """
    Insert historical NDVI records for the last `days` days.

    Called once at land registration to give the system immediate history.
    Returns the number of records inserted.
    """
    land = repository.get_land(db, land_id)
    if land is None:
        return 0

    lat = float(land.latitude)
    lon = float(land.longitude)

    records = modis_ndvi.fetch_ndvi_history(lat, lon, days=days)
    if not records:
        logger.warning("ndvi_backfill: no MODIS history for land_id=%s", land_id)
        return 0

    ds = repository.get_or_create_data_source(db, "MODIS-MOD13Q1")
    inserted = 0

    # Build NDVI series progressively for trend calculation
    ndvi_series: list[float] = []

    for rec in records:
        nir = rec.get("nir")
        red = rec.get("red")
        ndvi_value = (
            ndvi_engine.compute_ndvi(nir, red)
            if (nir is not None and red is not None)
            else rec.get("ndvi_modis")
        )
        if ndvi_value is None:
            continue

        try:
            from datetime import datetime as _dt
            record_ts = _dt.strptime(rec["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            continue

        ndvi_series.append(ndvi_value)
        trend = ndvi_engine.compute_trend(ndvi_series) if len(ndvi_series) >= 3 else "insufficient_data"
        health = ndvi_engine.classify_health(ndvi_value)
        month = record_ts.month
        growth_stage = ndvi_engine.estimate_growth_stage(ndvi_value, month, ndvi_series=ndvi_series)
        quality_flag = rec.get("quality_flag")
        confidence = ndvi_engine.compute_confidence(
            [quality_flag] if quality_flag is not None else []
        )

        row = repository.insert_land_crop_snapshot(
            db, land_id,
            ndvi_value=ndvi_value,
            growth_stage=growth_stage,
            ndvi_trend=trend,
            confidence=confidence,
            source_id=int(ds.source_id),
        )
        row.timestamp = record_ts   # backdate to the actual satellite date
        inserted += 1

    db.commit()
    logger.info("ndvi_backfill complete land_id=%s  records=%d", land_id, inserted)
    return inserted
