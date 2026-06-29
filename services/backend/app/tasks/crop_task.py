import logging
import numpy as np
from datetime import datetime
from sqlalchemy.orm import Session

from app.lands import repository
from app.cv import ndvi as ndvi_engine
from app.connectors import sentinel
from app.cv import indices
from app.cv import timeseries
from app.ml.crop_classifier import predict_crop

logger = logging.getLogger(__name__)


def run_crop_detection_task(land_id: int, db: Session, days: int = 90) -> None:
    """
    Analyzes historical Sentinel-2 data at the tile level.
    Extracts time-series features per pixel, runs the ML model per pixel,
    and aggregates to detect true multi-crop fields.
    """
    logger.info("Running pixel-level crop detection task for land_id=%s", land_id)

    # 1. Fetch raw Sentinel-2 history (Simulated arrays of shape T, H, W)
    timeseries_data = sentinel.fetch_sentinel_timeseries(land_id, days=days)
    dates = timeseries_data["dates"]
    
    b02 = timeseries_data["B02"]
    b03 = timeseries_data["B03"]
    b04 = timeseries_data["B04"]
    b08 = timeseries_data["B08"]
    b11 = timeseries_data["B11"]

    T, H, W = b08.shape
    if T < 3:
        logger.warning("Insufficient Sentinel-2 records for land_id=%s", land_id)
        return

    # 2. Compute vegetation indices
    ndvi_arr = indices.compute_ndvi(b08, b04)
    evi_arr = indices.compute_evi(b08, b04, b02)
    ndwi_arr = indices.compute_ndwi(b08, b11)
    savi_arr = indices.compute_savi(b08, b04)
    gndvi_arr = indices.compute_gndvi(b08, b03)

    # 3. Extract 10 statistical features per tile for each index
    # For now, we map these robust tile features to the 8 features expected by our existing ML model.
    # In a full deployment, the ML model would be trained directly on the 60-feature vector.
    ndvi_features = timeseries.extract_timeseries_features(ndvi_arr, dates)
    evi_features = timeseries.extract_timeseries_features(evi_arr, dates)
    ndwi_features = timeseries.extract_timeseries_features(ndwi_arr, dates)
    savi_features = timeseries.extract_timeseries_features(savi_arr, dates)
    gndvi_features = timeseries.extract_timeseries_features(gndvi_arr, dates)

    # 4. Flatten and Run ML on every single tile
    # Features: [ndvi_max, ndvi_mean, ndvi_std, peak_month, evi_max, ndwi_max, savi_max, gndvi_max]
    N = H * W
    X_pred = np.zeros((N, 8))
    X_pred[:, 0] = ndvi_features["max"].flatten()
    X_pred[:, 1] = ndvi_features["mean"].flatten()
    X_pred[:, 2] = ndvi_features["std"].flatten()
    X_pred[:, 3] = ndvi_features["peak_month"].flatten()
    X_pred[:, 4] = evi_features["max"].flatten()
    X_pred[:, 5] = ndwi_features["max"].flatten()
    X_pred[:, 6] = savi_features["max"].flatten()
    X_pred[:, 7] = gndvi_features["max"].flatten()

    logger.info("Predicting crops for %d tiles (10x10m resolution)", N)
    
    crop_counts = {}
    from app.ml.crop_classifier import load_model
    clf = load_model()
    
    # Predict all tiles efficiently
    probs = clf.predict_proba(X_pred)
    classes = clf.classes_
    
    # Take the top class for each tile
    top_class_idx = np.argmax(probs, axis=1)
    top_class_probs = np.max(probs, axis=1)

    for i in range(N):
        c_idx = top_class_idx[i]
        c_prob = top_class_probs[i]
        
        if c_prob > 0.4:  # Only count tiles with some confidence
            crop = classes[c_idx]
            if crop not in crop_counts:
                crop_counts[crop] = 0
            crop_counts[crop] += 1

    if not crop_counts:
        crop_counts["Unknown"] = N

    # 5. Aggregate to Crop Zones
    total_valid_tiles = sum(crop_counts.values())
    
    # Clear old zones
    from app.models.crop_zone import CropZone
    db.query(CropZone).filter(CropZone.land_id == land_id).delete()
    db.flush()

    primary_zone_id = None
    primary_crop = None
    
    # Sort crops by count descending
    sorted_crops = sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)

    for crop_type, count in sorted_crops:
        area_pct = (count / total_valid_tiles) * 100.0
        
        # Only create zones for crops > 5% coverage
        if area_pct < 5.0 and len(sorted_crops) > 1:
            continue
            
        if primary_crop is None:
            primary_crop = crop_type

        latest_ndvi = float(np.nanmedian(ndvi_arr[-1]))
        growth_stage = ndvi_engine.estimate_growth_stage(latest_ndvi, dates[-1].month)

        zone = CropZone(
            land_id=land_id,
            crop_type=crop_type,
            area_pct=round(area_pct, 2),
            status="active",
            avg_confidence=0.85, # Simulated high confidence for Sentinel pixels
            latest_ndvi=latest_ndvi,
            latest_growth_stage=growth_stage
        )
        db.add(zone)
        db.flush()
        
        if primary_zone_id is None:
            primary_zone_id = zone.zone_id

    # 6. Update existing land_crops rows with the primary zone_id
    rows = list(repository.list_land_crop_rows(db, land_id))
    for r in rows:
        r.zone_id = primary_zone_id
        r.crop_type = primary_crop
        r.confidence = 0.85

    db.commit()
    logger.info("Successfully updated crop intelligence for land_id=%s (primary zone_id=%s)", land_id, primary_zone_id)
