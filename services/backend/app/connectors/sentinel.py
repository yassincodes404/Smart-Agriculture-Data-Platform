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

def _build_preview_url(collection: str, item_id: str, bbox: list[float], mode: str = "true_color") -> str:
    """Build a Planetary Computer preview URL for an item, cropped to the land's bounding box."""
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
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


def _download_image(url: str, dest: Path, timeout: float = TIMEOUT) -> bool:
    """Download an image from a URL to a local file."""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "image" not in content_type and len(resp.content) < 1000:
                logger.warning("Response doesn't look like an image: %s bytes, type=%s",
                               len(resp.content), content_type)
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(resp.content)
            logger.info("Downloaded %d bytes → %s", len(resp.content), dest)
            return True
    except Exception as e:
        logger.error("Failed to download %s: %s", url, e)
        return False


def fetch_sentinel_visual_urls(
    bbox: list[float],
    max_cloud_cover: int = 15,
    limit: int = 6,
) -> list[dict]:
    """
    Query STAC API for the most recent clear Sentinel-2 images within a bbox.

    Returns a list of dicts, each with:
        source, date, cloud_cover_pct, item_id, collection,
        true_color_url, ndvi_url
    """
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": "2024-01-01T00:00:00Z/..",
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
        logger.exception("Unexpected error fetching Sentinel visuals: %s", e)
        return []


def fetch_and_download_sentinel_images(
    bbox: list[float],
    land_id: int,
    max_cloud_cover: int = 15,
    limit: int = 6,
) -> list[dict]:
    """
    Fetch Sentinel-2 STAC metadata AND download actual PNG images locally.

    Returns list of dicts with:
        date, cloud_cover_pct, image_type, local_path, local_filename
    """
    items = fetch_sentinel_visual_urls(bbox, max_cloud_cover, limit)
    if not items:
        return []

    downloaded = []
    for item in items:
        date_str = item["date"][:10].replace("-", "")  # 20260429
        cloud_pct = item["cloud_cover_pct"]

        # Download true color
        tc_filename = f"land{land_id}_{date_str}_true_color.png"
        tc_path = IMAGES_DIR / tc_filename
        if tc_path.exists() or _download_image(item["true_color_url"], tc_path):
            downloaded.append({
                "date": item["date"],
                "cloud_cover_pct": cloud_pct,
                "image_type": "true_color",
                "local_path": str(tc_path),
                "local_filename": tc_filename,
            })

        # Download NDVI
        ndvi_filename = f"land{land_id}_{date_str}_ndvi.png"
        ndvi_path = IMAGES_DIR / ndvi_filename
        if ndvi_path.exists() or _download_image(item["ndvi_url"], ndvi_path):
            downloaded.append({
                "date": item["date"],
                "cloud_cover_pct": cloud_pct,
                "image_type": "ndvi",
                "local_path": str(ndvi_path),
                "local_filename": ndvi_filename,
            })

    logger.info("Downloaded %d Sentinel images for land %s", len(downloaded), land_id)
    return downloaded
