"""crops/service.py — Crop intelligence business logic (5 endpoints)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.cv import ndvi as ndvi_engine
from app.crops.schemas import (
    CropDetectionResponse,
    CropHealthResponse,
    CropStatusResponse,
    CropTrendResponse,
    HarvestPredictionResponse,
    NDVIPoint,
)
from app.lands import repository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_crop_rows(db: Session, land_id: int):
    """Return all crop rows for a land, ascending by timestamp."""
    return list(repository.list_land_crop_rows(db, land_id))


def _latest_crop(db: Session, land_id: int):
    return repository.get_latest_crop_record(db, land_id)


# ---------------------------------------------------------------------------
# 1. Crop Detection
# ---------------------------------------------------------------------------

def get_crop_detection(db: Session, land_id: int) -> Optional[CropDetectionResponse]:
    land = repository.get_land(db, land_id)
    if land is None:
        return None

    latest = _latest_crop(db, land_id)
    if latest is None:
        return CropDetectionResponse(
            land_id=land_id,
            detected_crop_type=None,
            detection_method="unknown",
            confidence=0.0,
            ndvi_current=0.0,
            health="no_data",
            note="No NDVI data available yet. Run satellite task to populate.",
        )

    ndvi_val = float(latest.ndvi_value) if latest.ndvi_value is not None else 0.0
    confidence = float(latest.confidence) if latest.confidence is not None else 0.5

    # Infer crop type from stored value or NDVI spectral signature
    crop_type = latest.crop_type
    method = "user_defined" if crop_type else "spectral_signature"

    if not crop_type:
        # Simple spectral inference based on NDVI + season
        if ndvi_val > 0.55:
            crop_type = "wheat"      # high NDVI dense crop typical in delta
        elif ndvi_val > 0.35:
            crop_type = "corn"
        elif ndvi_val > 0.20:
            crop_type = "rice"
        else:
            crop_type = None
            method = "unknown"

    return CropDetectionResponse(
        land_id=land_id,
        detected_crop_type=crop_type,
        detection_method=method,
        confidence=confidence,
        ndvi_current=round(ndvi_val, 4),
        health=ndvi_engine.classify_health(ndvi_val),
        note=f"Detection based on NDVI={ndvi_val:.4f} from {latest.timestamp.date()}.",
    )


# ---------------------------------------------------------------------------
# 2. Crop Health
# ---------------------------------------------------------------------------

def get_crop_health(db: Session, land_id: int) -> Optional[CropHealthResponse]:
    land = repository.get_land(db, land_id)
    if land is None:
        return None

    latest = _latest_crop(db, land_id)
    if latest is None:
        return CropHealthResponse(
            land_id=land_id,
            ndvi_current=0.0,
            health_status="no_data",
            health_score=0,
            ndvi_expected_range=None,
            is_below_expected=False,
            advice="Register land and run satellite task to collect NDVI data.",
        )

    ndvi_val = float(latest.ndvi_value) if latest.ndvi_value is not None else 0.0
    health = ndvi_engine.classify_health(ndvi_val)
    score = ndvi_engine.health_score(ndvi_val)

    # Expected range from crop profiles
    expected_range = None
    is_below = False
    if latest.crop_type:
        from app.cv.ndvi import _CROP_PROFILES
        profile = _CROP_PROFILES.get(latest.crop_type.lower(), {})
        if profile:
            ndvi_min = profile.get("ndvi_min_healthy", 0.35)
            ndvi_peak = profile.get("ndvi_peak", 0.70)
            expected_range = {"min": ndvi_min, "max": ndvi_peak}
            is_below = ndvi_val < ndvi_min

    # Advice
    if health in ("bare_soil", "very_sparse"):
        advice = "Very low vegetation. Verify irrigation and check for crop failure."
    elif health == "stressed":
        advice = "Crop shows stress signs. Check water supply and soil conditions."
    elif health == "developing":
        advice = "Crop is developing normally. Monitor for continued growth."
    elif health in ("healthy", "very_healthy"):
        advice = "Crop health is good. Continue current management practices."
    else:
        advice = "Dense canopy detected. Monitor for over-growth or flooding."

    return CropHealthResponse(
        land_id=land_id,
        ndvi_current=round(ndvi_val, 4),
        health_status=health,
        health_score=score,
        ndvi_expected_range=expected_range,
        is_below_expected=is_below,
        advice=advice,
    )


# ---------------------------------------------------------------------------
# 3. Crop Status (growth stage + trend)
# ---------------------------------------------------------------------------

def get_crop_status(db: Session, land_id: int) -> Optional[CropStatusResponse]:
    land = repository.get_land(db, land_id)
    if land is None:
        return None

    latest = _latest_crop(db, land_id)
    if latest is None:
        return CropStatusResponse(
            land_id=land_id,
            growth_stage="unknown",
            ndvi_current=0.0,
            trend="insufficient_data",
            trend_slope=0.0,
            last_updated="never",
            monitoring_interval_days=int(land.monitoring_interval_days),
        )

    rows = _get_crop_rows(db, land_id)
    ndvi_series = [float(r.ndvi_value) for r in rows if r.ndvi_value is not None]

    ndvi_val = float(latest.ndvi_value) if latest.ndvi_value is not None else 0.0
    trend = ndvi_engine.compute_trend(ndvi_series)
    slope = ndvi_engine.compute_trend_slope(ndvi_series)

    return CropStatusResponse(
        land_id=land_id,
        growth_stage=latest.growth_stage or "unknown",
        ndvi_current=round(ndvi_val, 4),
        trend=trend,
        trend_slope=round(slope, 6),
        last_updated=latest.timestamp.isoformat(),
        monitoring_interval_days=int(land.monitoring_interval_days),
    )


# ---------------------------------------------------------------------------
# 4. Crop Trend (NDVI time-series)
# ---------------------------------------------------------------------------

def get_crop_trend(
    db: Session,
    land_id: int,
    days: int = 90,
) -> Optional[CropTrendResponse]:
    land = repository.get_land(db, land_id)
    if land is None:
        return None

    rows = _get_crop_rows(db, land_id)

    # Filter to last `days` worth of data
    from datetime import datetime, timezone, timedelta
    cutoff_aware = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_naive = cutoff_aware.replace(tzinfo=None)
    rows = [
        r for r in rows
        if (r.timestamp.tzinfo is not None and r.timestamp >= cutoff_aware)
        or (r.timestamp.tzinfo is None and r.timestamp >= cutoff_naive)
    ]

    if not rows:
        return CropTrendResponse(
            land_id=land_id,
            days_analyzed=days,
            ndvi_series=[],
            trend="insufficient_data",
            trend_slope=0.0,
            min_ndvi=0.0,
            max_ndvi=0.0,
            mean_ndvi=0.0,
            anomaly_detected=False,
        )

    ndvi_series = [float(r.ndvi_value) for r in rows if r.ndvi_value is not None]
    points = [
        NDVIPoint(
            date=r.timestamp.strftime("%Y-%m-%d"),
            ndvi=round(float(r.ndvi_value), 4) if r.ndvi_value is not None else 0.0,
            health=ndvi_engine.classify_health(float(r.ndvi_value) if r.ndvi_value else 0.0),
            growth_stage=r.growth_stage or "unknown",
        )
        for r in rows
    ]

    trend = ndvi_engine.compute_trend(ndvi_series)
    slope = ndvi_engine.compute_trend_slope(ndvi_series)
    anomaly = ndvi_engine.detect_anomaly(ndvi_series)

    return CropTrendResponse(
        land_id=land_id,
        days_analyzed=days,
        ndvi_series=points,
        trend=trend,
        trend_slope=round(slope, 6),
        min_ndvi=round(min(ndvi_series), 4) if ndvi_series else 0.0,
        max_ndvi=round(max(ndvi_series), 4) if ndvi_series else 0.0,
        mean_ndvi=round(sum(ndvi_series) / len(ndvi_series), 4) if ndvi_series else 0.0,
        anomaly_detected=anomaly,
    )


# ---------------------------------------------------------------------------
# 5. Harvest Prediction
# ---------------------------------------------------------------------------

def get_harvest_prediction(db: Session, land_id: int) -> Optional[HarvestPredictionResponse]:
    land = repository.get_land(db, land_id)
    if land is None:
        return None

    rows = _get_crop_rows(db, land_id)
    if len(rows) < 3:
        return HarvestPredictionResponse(
            land_id=land_id,
            prediction_available=False,
            peak_ndvi=None,
            peak_date=None,
            estimated_harvest_start=None,
            estimated_harvest_end=None,
            days_to_harvest=None,
            confidence_level="insufficient_data",
            note=f"Need at least 3 NDVI readings. Currently have {len(rows)}.",
        )

    ndvi_values = [float(r.ndvi_value) for r in rows if r.ndvi_value is not None]
    dates = [r.timestamp.strftime("%Y-%m-%d") for r in rows if r.ndvi_value is not None]
    crop_type = rows[-1].crop_type if rows else None

    prediction = ndvi_engine.predict_harvest_window(ndvi_values, dates, crop_type)

    if prediction is None:
        return HarvestPredictionResponse(
            land_id=land_id,
            prediction_available=False,
            peak_ndvi=None,
            peak_date=None,
            estimated_harvest_start=None,
            estimated_harvest_end=None,
            days_to_harvest=None,
            confidence_level="insufficient_data",
            note="Could not compute harvest prediction from available data.",
        )

    return HarvestPredictionResponse(
        land_id=land_id,
        prediction_available=True,
        peak_ndvi=prediction["peak_ndvi"],
        peak_date=prediction["peak_date"],
        estimated_harvest_start=prediction["estimated_harvest_start"],
        estimated_harvest_end=prediction["estimated_harvest_end"],
        days_to_harvest=prediction["days_to_harvest"],
        confidence_level=prediction["confidence"],
        note=f"Based on {len(ndvi_values)} NDVI observations over {len(rows) * 16} days.",
    )
