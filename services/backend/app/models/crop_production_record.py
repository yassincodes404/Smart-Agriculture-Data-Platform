"""
models/crop_production_record.py
---------------------------------
SQLAlchemy model for crop production domain data.

Stores per-governorate, per-crop, per-year production figures
ingested from CSV sources (CAPMAS, FAOSTAT).

Shared infrastructure (Location, IngestionBatch) is referenced
via ForeignKey — never duplicated.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, DECIMAL, ForeignKey, UniqueConstraint
)

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CropProductionRecord(Base):
    __tablename__ = "crop_production_records"

    crop_production_id = Column(
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
    crop_type      = Column(String(100), nullable=False)
    year           = Column(Integer, nullable=False)
    production_tons = Column(DECIMAL(14, 2), nullable=True)
    area_feddan    = Column(DECIMAL(12, 2), nullable=True)

    # Provenance
    source_system       = Column(String(100), nullable=False)
    ingestion_timestamp = Column(DateTime, nullable=False)
    created_at          = Column(DateTime, default=_utcnow, nullable=False)

    # Idempotency constraint: one row per location × crop × year × batch
    __table_args__ = (
        UniqueConstraint(
            "location_id", "crop_type", "year", "batch_id",
            name="uq_crop_production_location_crop_year_batch",
        ),
    )
