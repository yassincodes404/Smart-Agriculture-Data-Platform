"""
models/land_analytics_record.py
-------------------------------
SQLAlchemy ORM definition for the `land_analytics_records` table.

Stores the merged, per-land output of the land analytics pipeline.
Each row is a consolidated snapshot produced by joining climate,
satellite (NDVI), crop, soil, and water data for a single land parcel.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, DECIMAL, String, DateTime,
    ForeignKey, UniqueConstraint,
)
from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LandAnalyticsRecord(Base):
    __tablename__ = "land_analytics_records"

    record_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    land_id = Column(Integer, nullable=False, index=True)

    # Climate
    temperature = Column(DECIMAL(10, 4), nullable=True)
    rainfall = Column(DECIMAL(10, 4), nullable=True)

    # Satellite / vegetation
    ndvi = Column(DECIMAL(10, 4), nullable=True)
    vegetation_health = Column(String(50), nullable=True)

    # Crop
    crop_type = Column(String(100), nullable=True)

    # Soil
    soil_moisture = Column(DECIMAL(10, 4), nullable=True)

    # Water
    water_need_estimate = Column(DECIMAL(14, 2), nullable=True)

    # Risk assessment
    risk_level = Column(String(50), nullable=True)

    # Batch tracking
    batch_id = Column(Integer, ForeignKey("ingestion_batches.batch_id"), nullable=False)
    source_system = Column(String(100), nullable=False)
    ingestion_timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            'land_id', 'batch_id',
            name='uq_land_analytics_land_batch',
        ),
    )
