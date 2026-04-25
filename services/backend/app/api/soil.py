"""api/soil.py — 3 soil intelligence endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.soil import service as soil_service
from app.soil.schemas import SoilProfileResponse, SoilStatusResponse, SoilSuitabilityResponse

router = APIRouter(tags=["soil"])


@router.get(
    "/lands/{land_id}/soil-profile",
    response_model=SoilProfileResponse,
    summary="Full ISRIC SoilGrids property profile at 3 depths",
)
def soil_profile(land_id: int, db: Session = Depends(get_db)):
    """
    Returns pH, SOC, clay, sand, silt, bulk density, nitrogen, CEC
    at 0-5cm, 5-15cm and 15-30cm depths from ISRIC SoilGrids.

    Profile is fetched once at land registration and cached in the DB.
    """
    result = soil_service.get_soil_profile(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/soil-suitability",
    response_model=SoilSuitabilityResponse,
    summary="Crop suitability scores based on soil properties",
)
def soil_suitability(
    land_id: int,
    crop: Optional[str] = Query(None, description="Focus on specific crop (wheat, corn, rice, ...)"),
    db: Session = Depends(get_db),
):
    """
    Scores suitability for 6 crops using FAO/USDA soil thresholds.
    Returns ranked crop list + farming advice per soil deficiency.
    Uses geometric mean scoring — a single critical deficiency limits overall score.
    """
    result = soil_service.get_soil_suitability(db, land_id, crop=crop)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/soil-status",
    response_model=SoilStatusResponse,
    summary="Combined live moisture + static soil profile summary",
)
def soil_status(land_id: int, db: Session = Depends(get_db)):
    """
    Combines:
    - Live soil moisture (from Open-Meteo time-series)
    - Static soil property summary (from ISRIC SoilGrids profile)
    - Farming advice tailored to detected deficiencies
    """
    result = soil_service.get_soil_status(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result
