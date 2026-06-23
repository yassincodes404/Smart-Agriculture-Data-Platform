"""Scheduled job entrypoints."""

import logging

from app.db.session import SessionLocal
from app.pipeline import land_monitoring_pipeline

logger = logging.getLogger(__name__)


def run_land_monitoring_cycle() -> None:
    db = SessionLocal()
    try:
        land_monitoring_pipeline.run_monitoring_cycle(db)
    except Exception:
        logger.exception("scheduled land monitoring cycle failed")
        db.rollback()
    finally:
        db.close()
