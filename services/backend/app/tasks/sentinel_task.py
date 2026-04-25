"""
tasks/sentinel_task.py
----------------------
Background task to fetch and persist Sentinel-2 imagery URLs.
Called by the land discovery pipeline (Phase 4).
"""

import logging

from sqlalchemy.orm import Session

from app.connectors import sentinel
from app.lands import geometry, repository

logger = logging.getLogger(__name__)

def run_sentinel_visual_fetch(land_id: int, db: Session) -> bool:
    """
    Computes land bounding box, fetches Sentinel URLs, and stores them in DB.
    Returns True on success, False on failure.
    """
    logger.info("Starting Sentinel-2 visual fetch for land_id=%s", land_id)

    # 1. Get Land Geometry
    land = repository.get_land(db, land_id)
    if not land or not land.boundary_polygon:
        logger.error("Land %s has no boundary_polygon", land_id)
        return False

    ring = land.boundary_polygon.get("coordinates", [[]])[0]
    if not ring:
        return False

    try:
        bbox = geometry.compute_bounding_box(ring)
    except Exception as e:
        logger.error("Failed to compute bbox for land %s: %s", land_id, e)
        return False

    # 2. Fetch URLs from STAC API
    result = sentinel.fetch_sentinel_visual_urls(bbox)
    if not result:
        return False

    date_str = result["date"]
    cloud_pct = result["cloud_cover_pct"]
    true_color_url = result["true_color_url"]
    ndvi_url = result["ndvi_url"]

    logger.info(
        "Sentinel visuals found: date=%s, cloud_cover=%s%%", 
        date_str, cloud_pct
    )

    # 3. Store in DB
    try:
        # We need a data_sources entry, but for now we can leave source_id=None 
        # or use a generic one. Let's just use None since the URLs are self-contained.
        
        repository.insert_land_image(
            db=db,
            land_id=land_id,
            image_path=true_color_url,
            image_type="sentinel_true_color",
            cloud_cover_pct=cloud_pct,
            # we don't have ndvi_mean here since it's just an image
        )

        repository.insert_land_image(
            db=db,
            land_id=land_id,
            image_path=ndvi_url,
            image_type="sentinel_ndvi",
            cloud_cover_pct=cloud_pct,
        )
        
        db.commit()
        return True

    except Exception as e:
        logger.exception("Failed to insert Sentinel images into DB for land %s: %s", land_id, e)
        db.rollback()
        return False
