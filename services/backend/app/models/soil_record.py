"""
models/soil_record.py
----------------------
SQLAlchemy model for soil domain data.

Stores per-location soil moisture, type, and pH readings
ingested from CSV or JSON sources.

Shared infrastructure (Location, IngestionBatch) is referenced
via ForeignKey — never duplicated.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, DECIMAL, Float, ForeignKey, UniqueConstraint
)

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SoilRecord(Base):
    __tablename__ = "soil_records"

    soil_record_id = Column(
        Integer, primary_key=True, autoincrement=True, index=True
    )

    # Foreign keys to shared infrastructure
    location_id = Column(
        Integer, ForeignKey("locations.location_id"), nullable=False, index=True
    )
    batch_id = Column(
        Integer, ForeignKey("ingestion_batches.batch_id"), nullable=False
    )

    # Domain fields
    soil_moisture = Column(DECIMAL(5, 4), nullable=True)   # 0.0000 – 1.0000
    soil_type     = Column(String(100), nullable=True)
    ph            = Column(DECIMAL(4, 2), nullable=True)   # 0.00 – 14.00
    latitude      = Column(Float, nullable=True)
    longitude     = Column(Float, nullable=True)

    # Provenance
    source_system       = Column(String(100), nullable=False)
    ingestion_timestamp = Column(DateTime, nullable=False)
    created_at          = Column(DateTime, default=_utcnow, nullable=False)

    # Idempotency constraint: one row per location × soil_type × batch
    __table_args__ = (
        UniqueConstraint(
            "location_id", "soil_type", "batch_id",
            name="uq_soil_location_type_batch",
        ),
    )
