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
    CropZoneListResponse,
    LandDetailResponse,
    LandDiscoverAccepted,
    LandDiscoverRequest,
    LandImageListResponse,
    LandListResponse,
    LandTimeSeriesResponse,
)
from app.lands import service
from app.models.user import User
from app.pipeline.land_discovery_pipeline import run_in_session

router = APIRouter(tags=["lands"])


@router.get(
    "/lands",
    response_model=LandListResponse,
    summary="List all registered lands",
)
def list_lands(db: Session = Depends(get_db)):
    """Return all lands as a lightweight list."""
    return service.list_all_lands(db)

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


from fastapi import Response
from app.lands import repository

@router.get(
    "/lands/{land_id}/images/{image_id}/content",
    summary="Get raw image content (PNG)",
)
def get_land_image_content(
    land_id: int,
    image_id: int,
    db: Session = Depends(get_db),
):
    image = repository.get_land_image(db, image_id)
    if not image or image.land_id != land_id:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return Response(content=image.image_data, media_type="image/png")


@router.get(
    "/lands/{land_id}/crop-zones",
    response_model=CropZoneListResponse,
    summary="Crop zones within a land — multi-crop composition",
)
def list_crop_zones(
    land_id: int,
    db: Session = Depends(get_db),
):
    """Return all detected crop zones with area %, NDVI, growth stage, and yield stats."""
    result = service.list_crop_zones(db, land_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result


# ---------------------------------------------------------------------------
# Re-Analysis, Settings, NDVI Comparison
# ---------------------------------------------------------------------------

@router.post(
    "/lands/{land_id}/analyze",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger re-analysis — fetch new satellite images and update intelligence",
)
def reanalyze_land(
    land_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Queue a background task to:
    1. Fetch the latest Sentinel-2 images (true color + NDVI)
    2. Recompute crop health, growth stage, and yield estimates
    Old images and data are always preserved — only new data is appended.
    """
    land = service.get_land_detail(db, land_id)
    if land is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")

    from app.tasks.sentinel_task import run_sentinel_visual_fetch
    from app.tasks.satellite_task import run_ndvi_history_backfill
    from app.tasks.crop_task import run_crop_detection_task
    from app.ai.land_analyst import run_ai_land_analysis

    def _run_fetch():
        from app.db.session import SessionLocal
        local_db = SessionLocal()
        try:
            run_sentinel_visual_fetch(land_id, local_db)
            
            # Wipe existing for a clean re-analysis in demo
            from sqlalchemy import text
            local_db.execute(text("DELETE FROM land_crops WHERE land_id=:lid"), {"lid": land_id})
            local_db.commit()
            
            # Run the new tile-level ML pipeline
            run_ndvi_history_backfill(land_id, local_db, days=90)
            run_crop_detection_task(land_id, local_db, days=90)

            # Generate new AI Insights
            run_ai_land_analysis(land_id, local_db, user_id=None)
        finally:
            local_db.close()

    background_tasks.add_task(_run_fetch)
    return {"status": "processing", "message": "Re-analysis queued. New images will appear shortly."}


from pydantic import BaseModel as _PydanticBase

class _LandSettingsUpdate(_PydanticBase):
    monitoring_interval_days: Optional[int] = None


@router.patch(
    "/lands/{land_id}/settings",
    summary="Update per-land settings (update period, etc.)",
)
def update_land_settings(
    land_id: int,
    body: _LandSettingsUpdate,
    db: Session = Depends(get_db),
):
    from app.models.land import Land
    land = db.get(Land, land_id)
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")

    if body.monitoring_interval_days is not None:
        land.monitoring_interval_days = body.monitoring_interval_days

    db.commit()
    return {
        "status": "success",
        "monitoring_interval_days": int(land.monitoring_interval_days),
    }


@router.get(
    "/lands/{land_id}/ndvi-comparison",
    summary="Weekly NDVI progress comparison over time",
)
def get_ndvi_comparison(
    land_id: int,
    weeks: int = Query(8, ge=2, le=52),
    db: Session = Depends(get_db),
):
    from app.crops.service import get_ndvi_comparison as _get_ndvi_comparison
    result = _get_ndvi_comparison(db, land_id, weeks)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result
    return result
