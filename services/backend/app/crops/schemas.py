"""crops/schemas.py — Response schemas for all 5 crop intelligence endpoints."""

from typing import Any, Optional
from pydantic import BaseModel


class NDVIPoint(BaseModel):
    date: str
    ndvi: float
    health: str
    growth_stage: str


class CropDetectionResponse(BaseModel):
    land_id: int
    detected_crop_type: Optional[str]
    detection_method: str          # "spectral_signature" | "user_defined" | "unknown"
    confidence: float
    ndvi_current: float
    health: str
    note: str


class CropHealthResponse(BaseModel):
    land_id: int
    ndvi_current: float
    health_status: str             # bare_soil | stressed | developing | healthy | very_healthy
    health_score: int              # 0-100
    ndvi_expected_range: Optional[dict[str, float]]   # {min, max} from crop profiles
    is_below_expected: bool
    advice: str


class CropStatusResponse(BaseModel):
    land_id: int
    growth_stage: str
    ndvi_current: float
    trend: str                    # improving | stable | declining | insufficient_data
    trend_slope: float            # NDVI units per 16-day period
    last_updated: str             # ISO timestamp of latest NDVI reading
    monitoring_interval_days: int


class CropTrendResponse(BaseModel):
    land_id: int
    days_analyzed: int
    ndvi_series: list[NDVIPoint]
    trend: str
    trend_slope: float
    min_ndvi: float
    max_ndvi: float
    mean_ndvi: float
    anomaly_detected: bool


class HarvestPredictionResponse(BaseModel):
    land_id: int
    prediction_available: bool
    peak_ndvi: Optional[float]
    peak_date: Optional[str]
    estimated_harvest_start: Optional[str]
    estimated_harvest_end: Optional[str]
    days_to_harvest: Optional[int]
    confidence_level: str          # "high" | "medium" | "low" | "insufficient_data"
    note: str
