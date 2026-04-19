"""Business logic for land discovery and time-series reads."""

from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.lands import repository
from app.lands.schemas import LandTimeSeriesResponse, TimeSeriesPoint


def register_land_for_discovery(
    db: Session,
    *,
    name: str,
    latitude: Decimal,
    longitude: Decimal,
    description: Optional[str],
    user_id: Optional[int],
) -> int:
    land = repository.create_land(
        db,
        name=name,
        latitude=latitude,
        longitude=longitude,
        description=description,
        user_id=user_id,
    )
    db.commit()
    db.refresh(land)
    return int(land.land_id)


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
    # water | crops | soil — Phase 3 modular queries
    return LandTimeSeriesResponse(land_id=land_id, metric=metric, points=[])
