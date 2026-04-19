"""ORM for `land_images` (uploads + CV outputs)."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.types import JSON as SAJSON

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LandImage(Base):
    __tablename__ = "land_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    land_id = Column(Integer, ForeignKey("lands.land_id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=_utcnow, nullable=False)
    image_path = Column(String(500), nullable=False)
    image_type = Column(String(100), nullable=False)
    cv_analysis_summary = Column(SAJSON().with_variant(JSON, "mysql"), nullable=True)
    source_id = Column(Integer, ForeignKey("data_sources.source_id"), nullable=True)
