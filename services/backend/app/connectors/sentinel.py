"""
connectors/sentinel.py
----------------------
Connector to Microsoft Planetary Computer STAC API.
Fetches real Sentinel-2 L2A imagery:
  - True Color (RGB) rendered PNGs
  - NDVI false-color rendered PNGs

Images are downloaded to /data/images/ and served via static files.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
DATA_API_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png"

TIMEOUT = 45.0
IMAGES_DIR = Path(os.environ.get("IMAGES_DIR", "/data/images"))


DATA_API_CROP_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox}.png"

def _pad_bbox(bbox: list[float], pad: float = 0.005) -> list[float]:
    """Pad the bounding box to give surrounding context and increase image resolution."""
    return [
        bbox[0] - pad,
        bbox[1] - pad,
        bbox[2] + pad,
        bbox[3] + pad,
    ]

def _build_preview_url(collection: str, item_id: str, bbox: list[float], mode: str = "true_color") -> str:
    """Build a Planetary Computer preview URL for an item, cropped to the padded bounding box."""
    padded_bbox = _pad_bbox(bbox)
    bbox_str = f"{padded_bbox[0]},{padded_bbox[1]},{padded_bbox[2]},{padded_bbox[3]}"
    base_url = DATA_API_CROP_URL.format(bbox=bbox_str)
    
    if mode == "ndvi":
        params = {
            "collection": collection,
            "item": item_id,
            "expression": "(B08-B04)/(B08+B04)",
            "asset_as_band": "true",
            "colormap_name": "rdylgn",
            "rescale": "-0.2,0.8",
        }
    else:
        params = {
            "collection": collection,
            "item": item_id,
            "assets": "visual",
            "asset_bidx": "visual|1,2,3",
        }
    # Use httpx to build properly URL-encoded query string
    req = httpx.Request("GET", base_url, params=params)
    return str(req.url)


def _download_image(url: str, timeout: float = TIMEOUT) -> Optional[bytes]:
    """Download an image from a URL and return raw bytes."""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "image" not in content_type and len(resp.content) < 1000:
                logger.warning("Response doesn't look like an image: %s bytes, type=%s",
                               len(resp.content), content_type)
                return None
            logger.info("Downloaded %d bytes from %s", len(resp.content), url)
            return resp.content
    except Exception as e:
        logger.error("Failed to download %s: %s", url, e)
        return None


def fetch_sentinel_visual_urls(
    bbox: list[float],
    max_cloud_cover: int = 15,
    limit: int = 6,
    days: int = 90,
) -> list[dict]:
    """
    Query STAC API for the most recent clear Sentinel-2 images within a bbox.

    Returns a list of dicts, each with:
        source, date, cloud_cover_pct, item_id, collection,
        true_color_url, ndvi_url
    """
    from datetime import datetime, timedelta, timezone
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    datetime_str = f"{start_date.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_date.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": datetime_str,
        "query": {
            "eo:cloud_cover": {"lt": max_cloud_cover}
        },
        "limit": limit,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}]
    }

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            stac_resp = client.post(STAC_API_URL, json=payload)
            stac_resp.raise_for_status()
            data = stac_resp.json()

            features = data.get("features", [])
            if not features:
                logger.warning("No Sentinel-2 imagery found for bbox %s", bbox)
                return []

            results = []
            for item in features:
                item_id = item["id"]
                collection = item["collection"]
                properties = item.get("properties", {})
                date_str = properties.get("datetime", "")
                cloud_cover = properties.get("eo:cloud_cover", 0)

                tc_url = _build_preview_url(collection, item_id, bbox, "true_color")
                ndvi_url = _build_preview_url(collection, item_id, bbox, "ndvi")

                results.append({
                    "source": "ESA Sentinel-2 via Planetary Computer",
                    "date": date_str,
                    "cloud_cover_pct": cloud_cover,
                    "item_id": item_id,
                    "collection": collection,
                    "true_color_url": tc_url,
                    "ndvi_url": ndvi_url,
                })

            return results

    except httpx.RequestError as e:
        logger.error("Network error communicating with STAC API: %s", e)
        return []
    except Exception as e:
        logger.error("Failed to fetch Sentinel URLs: %s", e)
        return []

def fetch_sentinel_timeseries(land_id: int, days: int = 90) -> dict:
    """
    Simulates fetching a time-series of 10x10m Sentinel-2 tiles over `days`.
    In a full production environment, this would use odc-stac / rioxarray
    to extract actual reflectance arrays from the Planetary Computer STAC.
    
    Returns a dict with numpy arrays of shape (T, H, W):
      'dates': list of datetime objects (length T)
      'B02': Blue reflectance
      'B03': Green reflectance
      'B04': Red reflectance
      'B08': NIR reflectance
      'B11': SWIR reflectance
    """
    import numpy as np
    from datetime import datetime, timedelta
    from app.cv.preprocessing import preprocess_observation
    
    # Simulate a field with H=20, W=25 (500 tiles = 5 hectares)
    H, W = 20, 25
    T = max(3, days // 8) # One observation every 8 days
    
    dates = [datetime.now() - timedelta(days=days - i*8) for i in range(T)]
    rng = np.random.RandomState(seed=land_id * 1000)
    
    # We simulate 4 distinct crop zones per land.
    # To prevent all lands from looking identical, we add variance based on the seeded rng.
    amp_var = rng.uniform(0.8, 1.2, size=4)
    peak_shift = rng.uniform(-0.2, 0.2, size=4)
    
    # Shuffle which quadrant gets which crop type
    # Types: 0=Wheat-like, 1=Bare Soil, 2=Alfalfa, 3=Winter Onion
    crop_types = [0, 1, 2, 3]
    rng.shuffle(crop_types)
    
    # Create base arrays
    b02 = rng.uniform(0.02, 0.05, (T, H, W))
    b03 = rng.uniform(0.03, 0.08, (T, H, W))
    b04 = rng.uniform(0.04, 0.10, (T, H, W))
    b08 = rng.uniform(0.15, 0.25, (T, H, W))
    b11 = rng.uniform(0.10, 0.20, (T, H, W))
    
    # Apply time-series curves
    for t in range(T):
        progress = t / max(1, (T - 1))
        
        quadrants = [
            (slice(None, H//2), slice(None, W//2)),
            (slice(None, H//2), slice(W//2, None)),
            (slice(H//2, None), slice(None, W//2)),
            (slice(H//2, None), slice(W//2, None))
        ]
        
        for i, (q_y, q_x) in enumerate(quadrants):
            c_type = crop_types[i]
            q_shape = b08[t, q_y, q_x].shape
            
            if c_type == 0: # Wheat-like
                q_prog = np.clip(progress + peak_shift[0], 0, 1)
                peak = np.sin(q_prog * np.pi) * amp_var[0]
                b08[t, q_y, q_x] = 0.20 + (peak * 0.25) + rng.uniform(-0.02, 0.02, q_shape)
                b04[t, q_y, q_x] = 0.08 - (peak * 0.04) + rng.uniform(-0.01, 0.01, q_shape)
            elif c_type == 1: # Fallow / Bare Soil
                b08[t, q_y, q_x] = rng.uniform(0.12, 0.18, q_shape) * amp_var[1]
                b04[t, q_y, q_x] = rng.uniform(0.10, 0.15, q_shape) * amp_var[1]
            elif c_type == 2: # Alfalfa
                peak = 0.8 * amp_var[2]
                b08[t, q_y, q_x] = 0.30 + (peak * 0.20) + rng.uniform(-0.02, 0.02, q_shape)
                b04[t, q_y, q_x] = 0.05 - (peak * 0.02) + rng.uniform(-0.01, 0.01, q_shape)
            elif c_type == 3: # Winter Onion
                peak = np.exp(-((progress - (0.2 - peak_shift[3]))**2) / 0.05) * amp_var[3]
                b08[t, q_y, q_x] = 0.15 + (peak * 0.25) + rng.uniform(-0.02, 0.02, q_shape)
                b04[t, q_y, q_x] = 0.08 - (peak * 0.03) + rng.uniform(-0.01, 0.01, q_shape)
        
        
    # Clip arrays to valid reflectance ranges
    b02 = np.clip(b02, 0.0, 1.0)
    b03 = np.clip(b03, 0.0, 1.0)
    b04 = np.clip(b04, 0.0, 1.0)
    b08 = np.clip(b08, 0.0, 1.0)
    b11 = np.clip(b11, 0.0, 1.0)
    
    # Apply preprocessing to clean data and get quality scores
    clean_b02, clean_b03, clean_b04, clean_b08, clean_b11 = [], [], [], [], []
    quality_scores = []
    
    for t in range(T):
        bands = {
            "B02": b02[t],
            "B03": b03[t],
            "B04": b04[t],
            "B08": b08[t],
            "B11": b11[t],
        }
        cleaned, quality = preprocess_observation(bands, dates[t].isoformat())
        clean_b02.append(cleaned["B02"])
        clean_b03.append(cleaned["B03"])
        clean_b04.append(cleaned["B04"])
        clean_b08.append(cleaned["B08"])
        clean_b11.append(cleaned["B11"])
        quality_scores.append(quality.quality_score)
        
    return {
        "dates": dates,
        "quality_scores": quality_scores,
        "B02": np.stack(clean_b02),
        "B03": np.stack(clean_b03),
        "B04": np.stack(clean_b04),
        "B08": np.stack(clean_b08),
        "B11": np.stack(clean_b11)
    }


def fetch_and_download_sentinel_images(
    bbox: list[float],
    max_cloud_cover: int = 15,
    limit: int = 30,
    days: int = 90,
) -> list[dict]:
    """
    Fetch Sentinel-2 STAC metadata AND download actual PNG images into memory.

    Returns list of dicts with:
        date, cloud_cover_pct, image_type, image_data (bytes)
    """
    items = fetch_sentinel_visual_urls(bbox, max_cloud_cover, limit, days=days)
    if not items:
        return []

    downloaded = []
    for item in items:
        cloud_pct = item["cloud_cover_pct"]

        # Download true color
        tc_bytes = _download_image(item["true_color_url"])
        if tc_bytes:
            downloaded.append({
                "date": item["date"],
                "cloud_cover_pct": cloud_pct,
                "image_type": "true_color",
                "image_data": tc_bytes,
            })

        # Download NDVI
        ndvi_bytes = _download_image(item["ndvi_url"])
        if ndvi_bytes:
            downloaded.append({
                "date": item["date"],
                "cloud_cover_pct": cloud_pct,
                "image_type": "ndvi",
                "image_data": ndvi_bytes,
            })

    logger.info("Downloaded %d Sentinel images", len(downloaded))
    return downloaded
