"""Persistence helpers for `lands` and related geospatial tables."""

from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data_source import DataSource
from app.models.land import Land
from app.models.land_alert import LandAlert
from app.models.land_climate import LandClimate
from app.models.land_crop import LandCrop
from app.models.land_image import LandImage
from app.models.land_soil import LandSoil
from app.models.land_water import LandWater


# ---------------------------------------------------------------------------
# Land CRUD
# ---------------------------------------------------------------------------

def create_land(
    db: Session,
    *,
    name: str,
    latitude: Decimal,
    longitude: Decimal,
    description: Optional[str],
    user_id: Optional[int],
    boundary_polygon: Optional[dict] = None,
    area_hectares: Optional[float] = None,
) -> Land:
    row = Land(
        name=name,
        latitude=latitude,
        longitude=longitude,
        description=description,
        user_id=user_id,
        boundary_polygon=boundary_polygon,
        area_hectares=Decimal(str(area_hectares)) if area_hectares is not None else None,
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


# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------

def get_or_create_data_source(db: Session, name: str) -> DataSource:
    stmt = select(DataSource).where(DataSource.name == name)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing is not None:
        return existing
    row = DataSource(name=name)
    db.add(row)
    db.flush()
    return row


# ---------------------------------------------------------------------------
# Climate
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Crops
# ---------------------------------------------------------------------------

def insert_land_crop_snapshot(
    db: Session,
    land_id: int,
    *,
    crop_type: Optional[str] = None,
    ndvi_value: Optional[float] = None,
    estimated_yield_tons: Optional[float] = None,
    growth_stage: Optional[str] = None,
    ndvi_trend: Optional[str] = None,
    confidence: Optional[float] = None,
    source_id: Optional[int] = None,
) -> LandCrop:
    row = LandCrop(
        land_id=land_id,
        crop_type=crop_type,
        ndvi_value=Decimal(str(ndvi_value)) if ndvi_value is not None else None,
        estimated_yield_tons=Decimal(str(estimated_yield_tons)) if estimated_yield_tons is not None else None,
        growth_stage=growth_stage,
        ndvi_trend=ndvi_trend,
        confidence=Decimal(str(confidence)) if confidence is not None else None,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_crop_rows(db: Session, land_id: int, limit: Optional[int] = None) -> Sequence[LandCrop]:
    stmt = select(LandCrop).where(LandCrop.land_id == land_id).order_by(LandCrop.timestamp.asc())
    if limit is not None:
        stmt = stmt.limit(limit)
    return db.execute(stmt).scalars().all()


def get_latest_crop_record(db: Session, land_id: int) -> Optional[LandCrop]:
    stmt = (
        select(LandCrop)
        .where(LandCrop.land_id == land_id)
        .order_by(LandCrop.timestamp.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Water
# ---------------------------------------------------------------------------

def insert_land_water_snapshot(
    db: Session,
    land_id: int,
    *,
    estimated_water_usage_liters: Optional[float] = None,
    irrigation_status: Optional[str] = None,
    crop_water_requirement_mm: Optional[float] = None,
    water_efficiency_ratio: Optional[float] = None,
    source_id: Optional[int] = None,
) -> LandWater:
    row = LandWater(
        land_id=land_id,
        estimated_water_usage_liters=Decimal(str(estimated_water_usage_liters)) if estimated_water_usage_liters is not None else None,
        irrigation_status=irrigation_status,
        crop_water_requirement_mm=Decimal(str(crop_water_requirement_mm)) if crop_water_requirement_mm is not None else None,
        water_efficiency_ratio=Decimal(str(water_efficiency_ratio)) if water_efficiency_ratio is not None else None,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_water_rows(db: Session, land_id: int) -> Sequence[LandWater]:
    stmt = select(LandWater).where(LandWater.land_id == land_id).order_by(LandWater.timestamp.asc())
    return db.execute(stmt).scalars().all()


def get_latest_water_record(db: Session, land_id: int) -> Optional[LandWater]:
    stmt = (
        select(LandWater)
        .where(LandWater.land_id == land_id)
        .order_by(LandWater.timestamp.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Soil
# ---------------------------------------------------------------------------

def insert_land_soil_snapshot(
    db: Session,
    land_id: int,
    *,
    moisture_pct: Optional[float] = None,
    soil_type: Optional[str] = None,
    ph_level: Optional[float] = None,
    organic_matter_pct: Optional[float] = None,
    suitability_score: Optional[float] = None,
    source_id: Optional[int] = None,
) -> LandSoil:
    row = LandSoil(
        land_id=land_id,
        moisture_pct=Decimal(str(moisture_pct)) if moisture_pct is not None else None,
        soil_type=soil_type,
        ph_level=Decimal(str(ph_level)) if ph_level is not None else None,
        organic_matter_pct=Decimal(str(organic_matter_pct)) if organic_matter_pct is not None else None,
        suitability_score=Decimal(str(suitability_score)) if suitability_score is not None else None,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_soil_rows(db: Session, land_id: int) -> Sequence[LandSoil]:
    stmt = select(LandSoil).where(LandSoil.land_id == land_id).order_by(LandSoil.timestamp.asc())
    return db.execute(stmt).scalars().all()


def get_latest_soil_record(db: Session, land_id: int) -> Optional[LandSoil]:
    stmt = (
        select(LandSoil)
        .where(LandSoil.land_id == land_id)
        .order_by(LandSoil.timestamp.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

def insert_land_image(
    db: Session,
    land_id: int,
    *,
    image_path: str,
    image_type: str,
    cv_analysis_summary: Optional[dict] = None,
    ndvi_mean: Optional[float] = None,
    cloud_cover_pct: Optional[float] = None,
    source_id: Optional[int] = None,
) -> LandImage:
    row = LandImage(
        land_id=land_id,
        image_path=image_path,
        image_type=image_type,
        cv_analysis_summary=cv_analysis_summary,
        ndvi_mean=Decimal(str(ndvi_mean)) if ndvi_mean is not None else None,
        cloud_cover_pct=Decimal(str(cloud_cover_pct)) if cloud_cover_pct is not None else None,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_images(
    db: Session,
    land_id: int,
    image_type: Optional[str] = None,
) -> Sequence[LandImage]:
    stmt = select(LandImage).where(LandImage.land_id == land_id)
    if image_type:
        stmt = stmt.where(LandImage.image_type == image_type)
    stmt = stmt.order_by(LandImage.timestamp.asc())
    return db.execute(stmt).scalars().all()


def get_land_image(db: Session, image_id: int) -> Optional[LandImage]:
    return db.get(LandImage, image_id)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def insert_land_alert(
    db: Session,
    land_id: int,
    *,
    alert_type: str,
    severity: str,
    message: str,
    payload: Optional[dict] = None,
    source_id: Optional[int] = None,
) -> LandAlert:
    row = LandAlert(
        land_id=land_id,
        alert_type=alert_type,
        severity=severity,
        message=message,
        payload=payload,
        source_id=source_id,
    )
    db.add(row)
    db.flush()
    return row


def list_land_alerts(
    db: Session,
    land_id: int,
    *,
    unresolved_only: bool = False,
) -> Sequence[LandAlert]:
    stmt = select(LandAlert).where(LandAlert.land_id == land_id)
    if unresolved_only:
        stmt = stmt.where(LandAlert.resolved_at.is_(None))
    stmt = stmt.order_by(LandAlert.timestamp.desc())
    return db.execute(stmt).scalars().all()

