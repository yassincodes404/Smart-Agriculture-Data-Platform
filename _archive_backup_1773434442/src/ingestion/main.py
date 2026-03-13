"""
Smart Agriculture Data Platform — Ingestion Entry Point
========================================================
Orchestrates data ingestion from configured sources:
  • Google Earth Engine (NDVI, soil moisture, land cover)
  • NASA AppEEARS (MODIS, VIIRS)
  • Copernicus CDS / ERA5 (climate reanalysis)
  • SMAP (soil moisture HDF5)
"""

import os
import sys
import logging
from datetime import datetime

# ── Logging ──────────────────────────────────────────────────
try:
    from loguru import logger
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> — "
               "<level>{message}</level>",
        level="INFO",
    )
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    )
    logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# ── Source: Google Earth Engine ──────────────────────────────
def ingest_gee():
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not creds_path or not os.path.isfile(creds_path):
        logger.warning("GEE credentials not found — skipping.")
        return
    try:
        import ee
        credentials = ee.ServiceAccountCredentials("", creds_path)
        ee.Initialize(credentials)
        logger.info("Earth Engine initialised.")
        collection = (
            ee.ImageCollection("MODIS/061/MOD13A2")
            .filterDate(
                datetime.utcnow().strftime("%Y-%m-01"),
                datetime.utcnow().strftime("%Y-%m-%d"),
            )
            .select("NDVI")
        )
        count = collection.size().getInfo()
        logger.info(f"GEE — found {count} MODIS NDVI images for current month.")
    except Exception as exc:
        logger.error(f"GEE ingestion failed: {exc}")


# ── Source: Copernicus CDS (ERA5) ────────────────────────────
def ingest_era5():
    if not _env("CDSAPI_KEY"):
        logger.warning("CDSAPI_KEY not set — skipping ERA5.")
        return
    try:
        import cdsapi
        client = cdsapi.Client()
        logger.info("CDS API client initialised.")
        # TODO: implement ERA5 retrieval
    except Exception as exc:
        logger.error(f"ERA5 ingestion failed: {exc}")


# ── Source: NASA AppEEARS ────────────────────────────────────
def ingest_appeears():
    user = _env("APPEEARS_USER")
    password = _env("APPEEARS_PASSWORD")
    if not user or not password:
        logger.warning("AppEEARS credentials not set — skipping.")
        return
    try:
        import requests
        resp = requests.post(
            "https://appeears.earthdatacloud.nasa.gov/api/login",
            auth=(user, password),
        )
        resp.raise_for_status()
        logger.info("NASA AppEEARS authenticated.")
        # TODO: submit / poll area tasks
    except Exception as exc:
        logger.error(f"AppEEARS ingestion failed: {exc}")


# ── Source: SMAP (HDF5 soil moisture) ────────────────────────
def ingest_smap():
    smap_dir = "/app/data/smap"
    if not os.path.isdir(smap_dir):
        logger.info("No SMAP directory found — skipping.")
        return
    try:
        import h5py
        files = [f for f in os.listdir(smap_dir) if f.endswith((".h5", ".hdf"))]
        logger.info(f"Found {len(files)} SMAP files.")
        for fname in files:
            with h5py.File(os.path.join(smap_dir, fname), "r") as hf:
                logger.info(f"  {fname} — keys: {list(hf.keys())}")
    except Exception as exc:
        logger.error(f"SMAP ingestion failed: {exc}")


# ── Run all ingestors once ────────────────────────────────────
def run_pipeline():
    logger.info("=" * 60)
    logger.info("  Smart Agriculture Data Platform — Ingestion Pipeline")
    logger.info("=" * 60)

    ingest_gee()
    ingest_era5()
    ingest_appeears()
    ingest_smap()

    logger.info("Ingestion cycle finished. Waiting for next scheduled run …")


# ── Main (keeps container alive) ─────────────────────────────
def main():
    import time
    import schedule

    interval = int(_env("INGESTION_INTERVAL_HOURS", "1"))
    logger.info(f"Ingestion service started — will run every {interval} hour(s).")

    # Run immediately on startup
    run_pipeline()

    # Schedule future runs
    schedule.every(interval).hours.do(run_pipeline)

    # Keep the container alive
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
