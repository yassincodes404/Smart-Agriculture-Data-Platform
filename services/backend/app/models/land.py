"""
models/land.py
--------------
ORM for `lands` (geospatial root entity). DDL source: Database/geospatial_schema.sql
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.types import JSON as SAJSON

from app.models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Land(Base):
    __tablename__ = "lands"

    land_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    boundary_polygon = Column(SAJSON().with_variant(JSON, "mysql"), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="processing")
    created_at = Column(DateTime, default=_utcnow, nullable=False)
