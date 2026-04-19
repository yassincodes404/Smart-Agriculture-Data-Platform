"""Persistence helpers for `lands` and related geospatial tables."""

from typing import Optional, Sequence

from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data_source import DataSource
from app.models.land import Land
from app.models.land_climate import LandClimate


def create_land(
    db: Session,
    *,
    name: str,
    latitude: Decimal,
    longitude: Decimal,
    description: Optional[str],
    user_id: Optional[int],
) -> Land:
    row = Land(
        name=name,
        latitude=latitude,
        longitude=longitude,
        description=description,
        user_id=user_id,
        status="processing",
    )
    db.add(row)
    db.flush()
    return row


def get_land(db: Session, land_id: int) -> Optional[Land]:
    return db.get(Land, land_id)


def update_land_status(db: Session, land_id: int, status: str) -> None:
    land = db.get(Land, land_id)
    if land is None:
        return
    land.status = status


def list_land_ids_for_monitoring(db: Session) -> Sequence[int]:
    """Lands that should receive periodic monitoring snapshots."""
    stmt = select(Land.land_id).where(Land.status.in_(("active", "processing")))
    return [row[0] for row in db.execute(stmt)]


def get_or_create_data_source(db: Session, name: str) -> DataSource:
    stmt = select(DataSource).where(DataSource.name == name)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing is not None:
        return existing
    row = DataSource(name=name)
    db.add(row)
    db.flush()
    return row


def insert_land_climate_snapshot(
    db: Session,
    land_id: int,
    *,
    temperature_celsius: Optional[float] = None,
    humidity_pct: Optional[float] = None,
    rainfall_mm: Optional[float] = None,
    source_id: Optional[int] = None,
) -> LandClimate:
    row = LandClimate(
        land_id=land_id,
        temperature_celsius=Decimal(str(temperature_celsius)) if temperature_celsius is not None else None,
        humidity_pct=Decimal(str(humidity_pct)) if humidity_pct is not None else None,
        rainfall_mm=Decimal(str(rainfall_mm)) if rainfall_mm is not None else None,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_climate_rows(db: Session, land_id: int) -> Sequence[LandClimate]:
    stmt = select(LandClimate).where(LandClimate.land_id == land_id).order_by(LandClimate.timestamp.asc())
    return db.execute(stmt).scalars().all()
