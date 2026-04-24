"""
lands/service.py
----------------
Business logic for land registration, time-series reads, and image listing.

Land registration flow:
  1. Validate + close polygon ring
  2. Compute centroid (lat, lon) from polygon
  3. Compute area in hectares
  4. Persist land with geometry
  5. Return land_id for pipeline to process
"""

from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.lands import repository
from app.lands.geometry import (
    close_ring,
    compute_area_hectares,
    compute_centroid,
    validate_polygon,
)
from app.lands.schemas import (
    GeoJSONPolygon,
    LandDetailResponse,
    LandImageItem,
    LandImageListResponse,
    LandTimeSeriesResponse,
    TimeSeriesPoint,
)


def register_land_for_discovery(
    db: Session,
    *,
    name: str,
    geometry: GeoJSONPolygon,
    description: Optional[str],
    user_id: Optional[int],
) -> int:
    """
    Validate the GeoJSON polygon, compute centroid + area, persist, and return land_id.
    """
    outer_ring = geometry.coordinates[0]

    # Validate and close the ring
    validate_polygon(outer_ring)
    closed_ring = close_ring(outer_ring)

    # Compute centroid (lat, lon) and area
    centroid_lat, centroid_lng = compute_centroid(closed_ring)
    area_ha = compute_area_hectares(closed_ring)

    # Build closed GeoJSON geometry for storage
    closed_geojson = {
        "type": "Polygon",
        "coordinates": [closed_ring],
    }

    land = repository.create_land(
        db,
        name=name,
        latitude=Decimal(str(centroid_lat)),
        longitude=Decimal(str(centroid_lng)),
        description=description,
        user_id=user_id,
        boundary_polygon=closed_geojson,
        area_hectares=area_ha,
    )
    db.commit()
    db.refresh(land)
    return int(land.land_id)


def get_land_detail(db: Session, land_id: int) -> Optional[LandDetailResponse]:
    """Return full land detail including geometry and computed area."""
    land = repository.get_land(db, land_id)
    if land is None:
        return None
    return LandDetailResponse(
        land_id=int(land.land_id),
        name=land.name,
        description=land.description,
        latitude=float(land.latitude),
        longitude=float(land.longitude),
        area_hectares=float(land.area_hectares) if land.area_hectares is not None else None,
        status=land.status,
        boundary_polygon=land.boundary_polygon,
        created_at=land.created_at.isoformat(),
    )


def land_timeseries(
    db: Session,
    land_id: int,
    metric: str,
) -> Optional[LandTimeSeriesResponse]:
    if repository.get_land(db, land_id) is None:
        return None

    if metric == "climate":
        rows = repository.list_land_climate_rows(db, land_id)
        points: list[TimeSeriesPoint] = []
        for r in rows:
            payload = {}
            if r.humidity_pct is not None:
                payload["humidity_pct"] = float(r.humidity_pct)
            if r.rainfall_mm is not None:
                payload["rainfall_mm"] = float(r.rainfall_mm)
            points.append(
                TimeSeriesPoint(
                    timestamp=r.timestamp.isoformat(),
                    value=float(r.temperature_celsius) if r.temperature_celsius is not None else None,
                    payload=payload or None,
                )
            )
        return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=points)

    elif metric == "water":
        rows = repository.list_land_water_rows(db, land_id)
        points = []
        for r in rows:
            payload = {}
            if r.irrigation_status is not None:
                payload["irrigation_status"] = r.irrigation_status
            if r.crop_water_requirement_mm is not None:
                payload["crop_water_requirement_mm"] = float(r.crop_water_requirement_mm)
            if r.water_efficiency_ratio is not None:
                payload["water_efficiency_ratio"] = float(r.water_efficiency_ratio)
            points.append(
                TimeSeriesPoint(
                    timestamp=r.timestamp.isoformat(),
                    value=float(r.estimated_water_usage_liters) if r.estimated_water_usage_liters is not None else None,
                    payload=payload or None,
                )
            )
        return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=points)

    elif metric == "crops":
        rows = repository.list_land_crop_rows(db, land_id)
        points = []
        for r in rows:
            payload = {}
            if r.crop_type is not None:
                payload["crop_type"] = r.crop_type
            if r.estimated_yield_tons is not None:
                payload["estimated_yield_tons"] = float(r.estimated_yield_tons)
            if r.growth_stage is not None:
                payload["growth_stage"] = r.growth_stage
            if r.ndvi_trend is not None:
                payload["ndvi_trend"] = r.ndvi_trend
            if r.confidence is not None:
                payload["confidence"] = float(r.confidence)
            points.append(
                TimeSeriesPoint(
                    timestamp=r.timestamp.isoformat(),
                    value=float(r.ndvi_value) if r.ndvi_value is not None else None,
                    payload=payload or None,
                )
            )
        return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=points)

    elif metric == "soil":
        rows = repository.list_land_soil_rows(db, land_id)
        points = []
        for r in rows:
            payload = {}
            if r.soil_type is not None:
                payload["soil_type"] = r.soil_type
            if r.ph_level is not None:
                payload["ph_level"] = float(r.ph_level)
            if r.organic_matter_pct is not None:
                payload["organic_matter_pct"] = float(r.organic_matter_pct)
            if r.suitability_score is not None:
                payload["suitability_score"] = float(r.suitability_score)
            points.append(
                TimeSeriesPoint(
                    timestamp=r.timestamp.isoformat(),
                    value=float(r.moisture_pct) if r.moisture_pct is not None else None,
                    payload=payload or None,
                )
            )
        return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=points)

    return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=[])


def list_images(
    db: Session,
    land_id: int,
    image_type: Optional[str] = None,
) -> Optional[LandImageListResponse]:
    if repository.get_land(db, land_id) is None:
        return None
    rows = repository.list_land_images(db, land_id, image_type=image_type)
    items = [
        LandImageItem(
            id=int(r.id),
            date=r.timestamp.strftime("%Y-%m-%d"),
            image_type=r.image_type,
            image_path=r.image_path,
            ndvi_mean=float(r.ndvi_mean) if r.ndvi_mean is not None else None,
            cloud_cover_pct=float(r.cloud_cover_pct) if r.cloud_cover_pct is not None else None,
        )
        for r in rows
    ]
    return LandImageListResponse(land_id=land_id, images=items)
