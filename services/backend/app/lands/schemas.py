"""
lands/schemas.py
----------------
Pydantic schemas for land registration, time-series reads, and image listing.

Land registration accepts a GeoJSON Polygon geometry.
Centroid (lat/lon) and area are computed by the service layer.
"""

from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# GeoJSON geometry types
# ---------------------------------------------------------------------------

class GeoJSONPolygon(BaseModel):
    """
    A GeoJSON Polygon object.
    coordinates[0] is the outer ring: list of [longitude, latitude] pairs.
    First and last point may or may not be identical — service layer closes it.
    """
    type: Literal["Polygon"]
    coordinates: list[list[list[float]]] = Field(
        ...,
        description="Outer ring: [[ [lng, lat], [lng, lat], ... ]]",
    )

    @field_validator("coordinates")
    @classmethod
    def validate_ring(cls, v: list[list[list[float]]]) -> list[list[list[float]]]:
        if not v or not v[0]:
            raise ValueError("coordinates must contain at least one ring")
        outer = v[0]
        # Count unique points (exclude potential closing duplicate)
        unique = []
        for pt in outer:
            if pt not in unique:
                unique.append(pt)
        if len(unique) < 3:
            raise ValueError(
                f"Polygon outer ring must have at least 3 unique points, got {len(unique)}"
            )
        for pt in outer:
            if len(pt) < 2:
                raise ValueError("Each coordinate must be [longitude, latitude]")
        return v


# ---------------------------------------------------------------------------
# Land discover / register
# ---------------------------------------------------------------------------

class LandDiscoverRequest(BaseModel):
    """
    Request body for POST /lands/discover.
    Accepts a GeoJSON polygon drawn on a map OR generated from a circle.
    Centroid and area are computed server-side.
    """
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    geometry: GeoJSONPolygon


class LandDiscoverAccepted(BaseModel):
    status: str
    land_id: int


# ---------------------------------------------------------------------------
# Land detail
# ---------------------------------------------------------------------------

class LandDetailResponse(BaseModel):
    land_id: int
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    area_hectares: Optional[float]
    status: str
    boundary_polygon: Optional[dict[str, Any]]
    created_at: str


# ---------------------------------------------------------------------------
# Time-series
# ---------------------------------------------------------------------------

class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: Optional[float] = None
    payload: Optional[dict[str, Any]] = None


class LandTimeSeriesResponse(BaseModel):
    land_id: int
    metric: str
    points: list[TimeSeriesPoint]


# ---------------------------------------------------------------------------
# Image schemas
# ---------------------------------------------------------------------------

class LandImageItem(BaseModel):
    id: int
    date: str
    image_type: str
    image_path: str
    ndvi_mean: Optional[float] = None
    cloud_cover_pct: Optional[float] = None


class LandImageListResponse(BaseModel):
    land_id: int
    images: list[LandImageItem]
