"""
api/lands.py
------------
Land registration (GeoJSON polygon), time-series reads, and image gallery.
"""

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_optional, get_db
from app.lands.schemas import (
    LandDetailResponse,
    LandDiscoverAccepted,
    LandDiscoverRequest,
    LandImageListResponse,
    LandTimeSeriesResponse,
)
from app.lands import service
from app.models.user import User
from app.pipeline.land_discovery_pipeline import run_in_session

router = APIRouter(tags=["lands"])


@router.post(
    "/lands/discover",
    response_model=LandDiscoverAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Register a new land from a GeoJSON polygon",
)
def discover_land(
    body: LandDiscoverRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Accepts a GeoJSON Polygon (drawn manually OR generated from a circle).

    Server-side:
    - Validates and closes the polygon ring
    - Computes centroid (lat/lon)
    - Computes area in hectares
    - Stores boundary_polygon
    - Enqueues discovery pipeline (climate + soil + ET₀ fetch)
    """
    user_id = int(current_user.user_id) if current_user else None
    land_id = service.register_land_for_discovery(
        db,
        name=body.name,
        geometry=body.geometry,
        description=body.description,
        user_id=user_id,
    )
    background_tasks.add_task(run_in_session, land_id)
    return LandDiscoverAccepted(status="processing", land_id=land_id)


@router.get(
    "/lands/{land_id}",
    response_model=LandDetailResponse,
    summary="Get land detail including geometry and area",
)
def get_land_detail(
    land_id: int,
    db: Session = Depends(get_db),
):
    """Return full land detail: name, centroid, area_hectares, boundary_polygon, status."""
    result = service.get_land_detail(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/timeseries",
    response_model=LandTimeSeriesResponse,
    summary="Time-series data for a land metric",
)
def get_land_timeseries(
    land_id: int,
    metric: str = Query("climate", pattern="^(climate|water|crops|soil)$"),
    db: Session = Depends(get_db),
):
    result = service.land_timeseries(db, land_id, metric)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


@router.get(
    "/lands/{land_id}/images",
    response_model=LandImageListResponse,
    summary="Satellite and uploaded image gallery for a land",
)
def list_land_images(
    land_id: int,
    image_type: Optional[str] = Query(None, description="Filter: true_color, ndvi, user_upload"),
    db: Session = Depends(get_db),
):
    result = service.list_images(db, land_id, image_type=image_type)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result
