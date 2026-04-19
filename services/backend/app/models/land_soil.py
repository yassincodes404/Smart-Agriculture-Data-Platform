"""ORM for `land_soil` time-series."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LandSoil(Base):
    __tablename__ = "land_soil"

    id = Column(Integer, primary_key=True, autoincrement=True)
    land_id = Column(Integer, ForeignKey("lands.land_id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False)
    moisture_pct = Column(Numeric(10, 4), nullable=True)
    soil_type = Column(String(100), nullable=True)
    source_id = Column(Integer, ForeignKey("data_sources.source_id"), nullable=True)
