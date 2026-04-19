"""Pydantic schemas for land discovery and read APIs."""

from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


class LandDiscoverRequest(BaseModel):
    latitude: Decimal = Field(..., ge=-90, le=90)
    longitude: Decimal = Field(..., ge=-180, le=180)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class LandDiscoverAccepted(BaseModel):
    status: str
    land_id: int


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: Optional[float] = None
    payload: Optional[dict[str, Any]] = None


class LandTimeSeriesResponse(BaseModel):
    land_id: int
    metric: str
    points: list[TimeSeriesPoint]
