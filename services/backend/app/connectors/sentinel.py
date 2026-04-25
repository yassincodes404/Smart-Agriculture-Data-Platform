"""
connectors/sentinel.py
----------------------
Connector to Microsoft Planetary Computer STAC API and Data API.
Fetches high-resolution (10m) Sentinel-2 L2A visual imagery and on-the-fly NDVI renders.
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

STAC_API_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
DATA_API_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png"

# Default timeout for MS Planetary Computer API
TIMEOUT = 30.0

def fetch_sentinel_visual_urls(
    bbox: list[float],
    max_cloud_cover: int = 5
) -> Optional[dict]:
    """
    Query Planetary Computer STAC API for the most recent clear Sentinel-2 image
    within the bounding box.
    
    Returns a dict with visual URLs or None if API fails or no clear images found.
    """
    # Look back over the last 6-12 months for a clear image.
    # We use a broad range to guarantee a hit, even in cloudy seasons.
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": "2023-01-01T00:00:00Z/..", # Open-ended to latest
        "query": {
            "eo:cloud_cover": {"lt": max_cloud_cover}
        },
        "limit": 1,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}]
    }

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            stac_resp = client.post(STAC_API_URL, json=payload)
            stac_resp.raise_for_status()
            data = stac_resp.json()
            
            features = data.get("features", [])
            if not features:
                logger.warning("No Sentinel-2 imagery found for bbox %s with cloud cover < %s%%", bbox, max_cloud_cover)
                return None
                
            item = features[0]
            item_id = item["id"]
            collection = item["collection"]
            properties = item.get("properties", {})
            date_str = properties.get("datetime")
            cloud_cover = properties.get("eo:cloud_cover")
            
            # 1. True Color URL (Data API on-the-fly PNG)
            true_color_params = {
                "collection": collection,
                "item": item_id,
                "assets": "visual",
                "asset_bidx": "visual|1,2,3", # RGB bands
                "format": "png"
            }
            # We build the URL directly since it's a GET request for an <img> tag
            true_color_req = client.build_request("GET", DATA_API_URL, params=true_color_params)
            true_color_url = str(true_color_req.url)

            # 2. NDVI Rendered URL (Data API on-the-fly PNG)
            # Expression: (NIR - Red) / (NIR + Red)
            ndvi_params = {
                "collection": collection,
                "item": item_id,
                "expression": "(B08-B04)/(B08+B04)",
                "asset_as_band": "true",
                "colormap_name": "rdylgn",
                "rescale": "-0.2,0.8", # Standard NDVI range
                "format": "png",
            }
            ndvi_req = client.build_request("GET", DATA_API_URL, params=ndvi_params)
            ndvi_url = str(ndvi_req.url)

            return {
                "source": "ESA Sentinel-2 via Planetary Computer",
                "date": date_str,
                "cloud_cover_pct": cloud_cover,
                "true_color_url": true_color_url,
                "ndvi_url": ndvi_url
            }

    except httpx.RequestError as e:
        logger.error("Network error communicating with STAC API: %s", e)
        return None
    except Exception as e:
        logger.exception("Unexpected error fetching Sentinel visuals: %s", e)
        return None
