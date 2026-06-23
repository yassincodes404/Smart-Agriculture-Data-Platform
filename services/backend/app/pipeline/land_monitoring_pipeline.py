"""
land_monitoring_pipeline.py
---------------------------
Phase 3 scheduled cycle: refresh time-series, diffs, analytics summaries.
Invoked from `app.scheduler.jobs` (Docker service `agri_scheduler`).
"""

import logging
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.lands import repository

logger = logging.getLogger(__name__)


def run_monitoring_cycle(db: Session, land_ids: Optional[Iterable[int]] = None) -> None:
    """
    Placeholder monitoring pass.

    Later: for each land_id fetch yesterday climate / NDVI / water estimates,
    append `land_*` rows, optionally persist `analytics_summaries`.
    """
    ids = list(land_ids) if land_ids is not None else list(repository.list_land_ids_for_monitoring(db))
    if not ids:
        logger.info("monitoring cycle: no lands to process")
        return
    logger.info("monitoring cycle: placeholder for %d land(s)", len(ids))
