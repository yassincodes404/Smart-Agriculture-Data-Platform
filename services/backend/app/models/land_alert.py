"""ORM for `land_alerts` (anomalies & risk alerts)."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.types import JSON as SAJSON

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LandAlert(Base):
    __tablename__ = "land_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    land_id = Column(Integer, ForeignKey("lands.land_id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False)
    alert_type = Column(String(100), nullable=False)          # ndvi_drop, heat_stress, drought, disease_risk
    severity = Column(String(20), nullable=False)             # low, medium, high, critical
    message = Column(Text, nullable=False)
    payload = Column(SAJSON().with_variant(JSON, "mysql"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    source_id = Column(Integer, ForeignKey("data_sources.source_id"), nullable=True)
