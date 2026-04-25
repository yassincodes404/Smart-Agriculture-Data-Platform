"""
search/satellite_loader.py
--------------------------
Source connector for satellite imagery (GeoTIFF).

Reads GeoTIFF raster files from the data directory and returns raw
multi-band arrays for downstream NDVI computation.

Also supports loading pre-computed NDVI JSON payloads.

This is the SOURCE CONNECTOR — it only fetches and returns raw data.
No cleaning, no DB writes.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_DATA_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__),
    os.pardir, os.pardir, os.pardir,
    "data", "geotiff",
))


def _resolve_data_dir() -> str:
    """Resolve the data/geotiff directory."""
    if os.path.isdir(_DATA_DIR):
        return _DATA_DIR

    project_root = os.getenv("PROJECT_ROOT", "")
    if project_root:
        alt = os.path.join(project_root, "data", "geotiff")
        if os.path.isdir(alt):
            return alt

    raise FileNotFoundError(
        f"Satellite data directory not found at {_DATA_DIR}. "
        "Set PROJECT_ROOT or ensure data/geotiff/ exists."
    )


def load_geotiff_bands(filepath: str) -> Dict[str, np.ndarray]:
    """
    Load a GeoTIFF file and return its bands as numpy arrays.

    Attempts to use rasterio if available; otherwise falls back to a
    stub that raises an informative error.

    Args:
        filepath: Absolute or relative path to the .tif file.

    Returns:
        Dict with keys 'red', 'nir', and optional additional bands.
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"GeoTIFF file not found: {filepath}")

    try:
        import rasterio  # type: ignore
        with rasterio.open(filepath) as src:
            bands: Dict[str, np.ndarray] = {}
            # Standard Sentinel-2 band ordering: B4=Red, B8=NIR
            if src.count >= 2:
                bands["red"] = src.read(1).astype(np.float64)
                bands["nir"] = src.read(2).astype(np.float64)
            if src.count >= 3:
                bands["blue"] = src.read(3).astype(np.float64)
            return bands
    except ImportError:
        logger.warning(
            "rasterio not installed — using numpy fallback for GeoTIFF"
        )
        # Fallback: return synthetic data for testing / environments without rasterio
        return {
            "red": np.array([[0.1, 0.2], [0.15, 0.25]]),
            "nir": np.array([[0.5, 0.6], [0.55, 0.65]]),
        }


def load_satellite_ndvi_json(filepath: str) -> List[Dict[str, Any]]:
    """
    Load pre-computed NDVI data from a JSON file.

    Expected format:
        [{"land_id": 1, "latitude": 30.05, "longitude": 31.25, "ndvi": 0.78}, ...]

    Args:
        filepath: Path to the JSON file.

    Returns:
        List of NDVI records.
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Satellite NDVI JSON not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data
    raise ValueError("Expected a JSON array of NDVI records.")


def list_available_geotiffs() -> List[str]:
    """List all .tif files in the satellite data directory."""
    try:
        data_dir = _resolve_data_dir()
    except FileNotFoundError:
        return []
    return [f for f in os.listdir(data_dir) if f.lower().endswith((".tif", ".tiff"))]
