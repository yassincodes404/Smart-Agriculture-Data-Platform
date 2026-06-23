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
    result = crop_service.get_crop_health(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


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
    result = crop_service.get_harvest_prediction(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result
