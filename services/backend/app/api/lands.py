"""
api/lands.py
------------
Land discovery (Phase 2) and read scaffolding aligned with Geospatial docs.
"""

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user_optional, get_db
from app.lands.schemas import LandDiscoverAccepted, LandDiscoverRequest, LandTimeSeriesResponse
from app.lands import service
from app.models.user import User
from app.pipeline.land_discovery_pipeline import run_in_session

router = APIRouter(tags=["lands"])


@router.post("/lands/discover", response_model=LandDiscoverAccepted, status_code=status.HTTP_202_ACCEPTED)
def discover_land(
    body: LandDiscoverRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Persist a Land row, return 202, enqueue discovery pipeline (non-blocking).
    """
    user_id = int(current_user.user_id) if current_user else None
    land_id = service.register_land_for_discovery(
        db,
        name=body.name,
        latitude=body.latitude,
        longitude=body.longitude,
        description=body.description,
        user_id=user_id,
    )
    background_tasks.add_task(run_in_session, land_id)
    return LandDiscoverAccepted(status="processing", land_id=land_id)


@router.get("/lands/{land_id}/timeseries", response_model=LandTimeSeriesResponse)
def get_land_timeseries(
    land_id: int,
    metric: str = Query("climate", pattern="^(climate|water|crops|soil)$"),
    db: Session = Depends(get_db),
):
    result = service.land_timeseries(db, land_id, metric)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land not found")
    return result
