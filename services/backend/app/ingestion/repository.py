"""
ingestion/repository.py
-----------------------
Repository for handling ingestion models (batch, errors, metadata).
"""

from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.models.ingestion_batch import IngestionBatch
from app.models.etl_error import EtlError
from app.models.location import Location
from app.models.climate_record import ClimateRecord
from app.models.water_record import WaterRecord
from app.models.land_analytics_record import LandAnalyticsRecord

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

def create_batch(db: Session, source_system: str) -> IngestionBatch:
    batch = IngestionBatch(
        source_system=source_system,
        status="IN_PROGRESS"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch

def mark_batch_completed(db: Session, batch_id: int, status: str):
    batch = db.query(IngestionBatch).filter(IngestionBatch.batch_id == batch_id).first()
    if batch:
        batch.status = status
        batch.completed_at = _utcnow()
        db.commit()

def log_error(db: Session, batch_id: int, stage: str, error_msg: str, record: str = None):
    err = EtlError(
        batch_id=batch_id,
        stage_name=stage,
        error_code="VALIDATION_FAILED",
        error_message=error_msg,
        record_key=record[:255] if record else None
    )
    db.add(err)
    db.commit()

def get_or_create_location(db: Session, governorate: str) -> Location:
    loc = db.query(Location).filter(Location.governorate == governorate).first()
    if not loc:
        loc = Location(governorate=governorate)
        db.add(loc)
        db.commit()
        db.refresh(loc)
    return loc

def insert_climate_record(db: Session, record_data: dict, batch_id: int, location_id: int):
    try:
        record = ClimateRecord(
            location_id=location_id,
            year=record_data["year"],
            temperature_mean=record_data["temperature_mean"],
            humidity_pct=record_data["humidity_pct"],
            batch_id=batch_id,
            source_system="CSV_Upload",
            ingestion_timestamp=_utcnow()
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        err_msg = str(e)
        log_error(db, batch_id, "DB_INSERT", err_msg, str(record_data))
        raise e


def insert_water_record(db: Session, record_data: dict, batch_id: int, location_id: int):
    try:
        record = WaterRecord(
            location_id=location_id,
            crop=record_data["crop"],
            year=record_data["year"],
            water_consumption_m3=record_data["water_consumption_m3"],
            irrigation_type=record_data["irrigation_type"],
            batch_id=batch_id,
            source_system="CSV_Upload",
            ingestion_timestamp=_utcnow()
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        err_msg = str(e)
        log_error(db, batch_id, "DB_INSERT", err_msg, str(record_data))
        raise e


def insert_land_analytics_record(
    db: Session,
    record_data: dict,
    batch_id: int,
    location_id: int,
):
    """
    Insert a single land analytics record into the database.

    Args:
        db: SQLAlchemy session.
        record_data: Merged analytics dict with all domain fields.
        batch_id: Current ingestion batch ID.
        location_id: FK to locations table.

    Raises:
        Exception: On insert failure (after rollback and error logging).
    """
    try:
        record = LandAnalyticsRecord(
            location_id=location_id,
            land_id=record_data["land_id"],
            temperature=record_data.get("temperature"),
            rainfall=record_data.get("rainfall"),
            ndvi=record_data.get("ndvi"),
            vegetation_health=record_data.get("vegetation_health"),
            crop_type=record_data.get("crop_type"),
            soil_moisture=record_data.get("soil_moisture"),
            water_need_estimate=record_data.get("water_need_estimate"),
            risk_level=record_data.get("risk_level"),
            batch_id=batch_id,
            source_system="LandAnalytics_Pipeline",
            ingestion_timestamp=_utcnow(),
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        err_msg = str(e)
        log_error(db, batch_id, "DB_INSERT", err_msg, str(record_data))
        raise e

