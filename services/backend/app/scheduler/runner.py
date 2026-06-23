"""
Blocking APScheduler loop for the `agri_scheduler` Docker service.

Configure interval with `LAND_MONITOR_INTERVAL_MINUTES` in `.env.backend`.
"""

from __future__ import annotations

import logging
import signal
import sys

from apscheduler.schedulers.blocking import BlockingScheduler

from app.core.config import settings
from app.scheduler import jobs

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger(__name__)


def main() -> None:
    scheduler = BlockingScheduler()
    scheduler.add_job(
        jobs.run_land_monitoring_cycle,
        "interval",
        minutes=max(1, settings.LAND_MONITOR_INTERVAL_MINUTES),
        id="land_monitoring",
        replace_existing=True,
    )

    def shutdown(signum: int, frame: object | None) -> None:
        if scheduler.running:
            scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info(
        "scheduler started: land_monitoring every %s minute(s)",
        settings.LAND_MONITOR_INTERVAL_MINUTES,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
