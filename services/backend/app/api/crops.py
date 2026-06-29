"""api/crops.py — 5 crop intelligence endpoints under /lands/{id}/..."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.crops.schemas import (
    CropDetectionResponse,
    CropHealthResponse,
    CropStatusResponse,
    CropTrendResponse,
    HarvestPredictionResponse,
)
from app.crops import service as crop_service

router = APIRouter(tags=["crops"])


@router.get(
    "/lands/{land_id}/crop-detection",
    response_model=CropDetectionResponse,
    summary="Detect likely crop type from NDVI spectral signature",
)
def crop_detection(land_id: int, db: Session = Depends(get_db)):
    """
    Returns the most likely crop type based on NDVI value and season.
    Uses crop_profiles.json reference data for spectral matching.
    """
    result = crop_service.get_crop_detection(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/crop-health",
    response_model=CropHealthResponse,
    summary="Current crop health based on NDVI vs expected range",
)
def crop_health(land_id: int, db: Session = Depends(get_db)):
    """
    Compares current NDVI against expected range from crop profiles.
    Returns health status (0–100 score), classification, and farming advice.
    """
    from app.intelligence.engine import CropIntelligenceEngine
    engine = CropIntelligenceEngine()
    report = engine.analyze_land(land_id, db)
    
    if report.land_id == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
        
    zones_health = []
    overall_ndvi = 0.0
    for z in report.zones:
        # map to ZoneHealthItem
        zones_health.append({
            "zone_id": z.zone_id,
            "crop_type": z.crop_type,
            "ndvi_current": z.ndvi_current,
            "health_score": z.health_score,
            "health_status": "excellent" if z.health_score >= 85 else "good" if z.health_score >= 70 else "fair" if z.health_score >= 50 else "poor",
            "advice": "Monitor crop conditions"
        })
        if z.ndvi_current > overall_ndvi:
            overall_ndvi = z.ndvi_current
            
    overall_status = "excellent" if report.overall_health >= 85 else "good" if report.overall_health >= 70 else "fair" if report.overall_health >= 50 else "poor"
        
    return {
        "land_id": land_id,
        "ndvi_current": overall_ndvi,
        "overall_health_score": report.overall_health,
        "overall_health_status": overall_status,
        "health_score": report.overall_health,
        "health_status": overall_status,
        "zones": zones_health
    }


@router.get(
    "/lands/{land_id}/crop-status",
    response_model=CropStatusResponse,
    summary="Current growth stage and NDVI trend",
)
def crop_status(land_id: int, db: Session = Depends(get_db)):
    """
    Returns current growth stage (planting → vegetative → flowering → maturity → harvest)
    and NDVI trend direction (improving / stable / declining).
    """
    result = crop_service.get_crop_status(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/crop-trend",
    response_model=CropTrendResponse,
    summary="NDVI time-series with trend analysis",
)
def crop_trend(
    land_id: int,
    days: int = Query(90, ge=16, le=365, description="Analysis window in days"),
    db: Session = Depends(get_db),
):
    """
    Returns full NDVI time-series for the requested period.
    Includes trend direction, slope (NDVI/16-day), min/max/mean, and anomaly flag.
    """
    result = crop_service.get_crop_trend(db, land_id, days=days)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/harvest-prediction",
    response_model=HarvestPredictionResponse,
    summary="Estimated harvest window based on NDVI peak analysis",
)
def harvest_prediction(land_id: int, db: Session = Depends(get_db)):
    """
    Detects NDVI peak (flowering/pollination) and uses crop calendar to
    estimate the harvest start/end window.
    Requires at least 3 historical NDVI readings.
    """
    from app.intelligence.engine import CropIntelligenceEngine
    engine = CropIntelligenceEngine()
    report = engine.analyze_land(land_id, db)
    
    if report.land_id == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
        
    zones_harvest = []
    overall_days = None
    overall_start = None
    for z in report.zones:
        zones_harvest.append({
            "zone_id": z.zone_id,
            "crop_type": z.crop_type,
            "prediction_available": z.next_harvest_days is not None,
            "reason_unavailable": None if z.next_harvest_days is not None else "Insufficient data",
            "estimated_harvest_start": z.next_harvest_est.isoformat() if z.next_harvest_est else None,
            "estimated_harvest_end": (z.next_harvest_est + __import__('datetime').timedelta(days=7)).isoformat() if z.next_harvest_est else None,
            "days_to_harvest": z.next_harvest_days,
            "confidence": z.harvest_confidence,
            "latest_growth_stage": z.growth_stage
        })
        if z.next_harvest_days is not None:
            if overall_days is None or z.next_harvest_days < overall_days:
                overall_days = z.next_harvest_days
                overall_start = z.next_harvest_est

    return {
        "land_id": land_id,
        "prediction_available": overall_days is not None,
        "days_to_harvest": overall_days,
        "estimated_harvest_start": overall_start.isoformat() if overall_start else None,
        "estimated_harvest_end": (overall_start + __import__('datetime').timedelta(days=7)).isoformat() if overall_start else None,
        "zones": zones_harvest
    }
