"""
pipeline/feature_engineering.py
-------------------------------
Processing / feature engineering layer for the land analytics pipeline.

Functions here transform raw parsed data into derived features:
    - NDVI from GeoTIFF red/NIR bands
    - Climate extraction from NetCDF grid by lat/lon
    - Water usage estimation
    - Vegetation health index computation
    - Risk level assessment

This layer sits between validation and storage in the pipeline flow.
It is NOT a cleaning step — it produces NEW derived values.
"""

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# NDVI Calculation from GeoTIFF Bands
# ---------------------------------------------------------------------------

def calculate_ndvi_from_bands(
    red: np.ndarray,
    nir: np.ndarray,
) -> np.ndarray:
    """
    Calculate Normalised Difference Vegetation Index from red and NIR bands.

    Formula: NDVI = (NIR - Red) / (NIR + Red)

    Args:
        red: 2D numpy array of red band reflectance values.
        nir: 2D numpy array of NIR band reflectance values.

    Returns:
        2D numpy array of NDVI values clipped to [0, 1].
    """
    red = red.astype(np.float64)
    nir = nir.astype(np.float64)

    denominator = nir + red
    # Avoid division by zero — set those pixels to 0
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = np.where(denominator > 0, (nir - red) / denominator, 0.0)

    # Clip to valid vegetation range [0, 1]
    ndvi = np.clip(ndvi, 0.0, 1.0)
    return ndvi


def calculate_ndvi_from_geotiff(bands: Dict[str, np.ndarray]) -> float:
    """
    Calculate mean NDVI from a dict of GeoTIFF bands.

    Args:
        bands: Dict with 'red' and 'nir' keys mapping to numpy arrays.

    Returns:
        Mean NDVI value (float in [0, 1]).
    """
    if "red" not in bands or "nir" not in bands:
        raise ValueError("GeoTIFF bands must contain 'red' and 'nir' keys.")

    ndvi_array = calculate_ndvi_from_bands(bands["red"], bands["nir"])
    mean_ndvi = float(np.nanmean(ndvi_array))

    logger.debug(f"Computed mean NDVI: {mean_ndvi:.4f}")
    return round(mean_ndvi, 4)


def calculate_ndvi_at_point(
    bands: Dict[str, np.ndarray],
    row: int,
    col: int,
) -> float:
    """
    Calculate NDVI at a specific pixel location.

    Args:
        bands: Dict with 'red' and 'nir' keys.
        row: Pixel row index.
        col: Pixel column index.

    Returns:
        NDVI value at (row, col).
    """
    red_val = float(bands["red"][row, col])
    nir_val = float(bands["nir"][row, col])

    denominator = nir_val + red_val
    if denominator == 0:
        return 0.0

    ndvi = (nir_val - red_val) / denominator
    return round(max(0.0, min(1.0, ndvi)), 4)


# ---------------------------------------------------------------------------
# NetCDF Extraction by Location
# ---------------------------------------------------------------------------

def extract_netcdf_by_location(
    latitude: float,
    longitude: float,
    nc_data: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Extract climate variables from a NetCDF dataset at a given lat/lon.

    If rasterio/xarray is not available or nc_data is None, returns
    a stub dict for environments without the full geospatial stack.

    Args:
        latitude: Target latitude.
        longitude: Target longitude.
        nc_data: Pre-loaded xarray Dataset or None.

    Returns:
        Dict with extracted climate variables (temperature, rainfall).
    """
    if nc_data is not None:
        try:
            import xarray as xr  # type: ignore
            if isinstance(nc_data, xr.Dataset):
                point = nc_data.sel(lat=latitude, lon=longitude, method="nearest")
                result: Dict[str, Any] = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "temperature": float(point["temperature"].values)
                    if "temperature" in point else None,
                    "rainfall": float(point["rainfall"].values)
                    if "rainfall" in point else None,
                }
                return result
        except Exception as e:
            logger.warning(f"NetCDF extraction failed for ({latitude}, {longitude}): {e}")

    # Fallback: return stub data with None values
    logger.info(
        f"Using stub NetCDF extraction for ({latitude}, {longitude})"
    )
    return {
        "latitude": latitude,
        "longitude": longitude,
        "temperature": None,
        "rainfall": None,
    }


# ---------------------------------------------------------------------------
# Water Usage Estimation
# ---------------------------------------------------------------------------

def estimate_water_usage(
    crop_type: str,
    area_feddan: float = 1.0,
    soil_moisture: float = 0.5,
    temperature: float = 25.0,
    rainfall: float = 0.0,
) -> float:
    """
    Estimate water need in litres for a given crop and conditions.

    Uses a simplified crop coefficient (Kc) approach:
        Base ETc = Kc × reference_ET × area
        Adjusted for soil moisture and rainfall

    Args:
        crop_type: Name of the crop (e.g., "Wheat", "Rice").
        area_feddan: Area in feddans (1 feddan ≈ 4200 m²).
        soil_moisture: Current soil moisture fraction (0–1).
        temperature: Current temperature in °C.
        rainfall: Recent rainfall in mm.

    Returns:
        Estimated water need in litres.
    """
    # Crop coefficients (simplified Kc values)
    kc_table: Dict[str, float] = {
        "wheat": 1.0,
        "rice": 1.4,
        "cotton": 1.15,
        "maize": 1.2,
        "corn": 1.2,
        "sugarcane": 1.3,
        "barley": 0.95,
        "clover": 0.9,
        "vegetables": 1.05,
        "fruit": 1.1,
        "citrus": 0.85,
    }

    kc = kc_table.get((crop_type or "wheat").lower().strip(), 1.0)

    # Simplified reference ET (Hargreaves-style approximation)
    # ET0 ≈ 0.0023 × (T + 17.8) × Trange^0.5 × Ra
    # We use a simplified version: ET0 ≈ max(0.5, 0.1 × T)
    et0 = max(0.5, 0.1 * temperature)

    # Area conversion: 1 feddan ≈ 4200 m²
    area_m2 = area_feddan * 4200.0

    # Base water need (litres) = ET0 × Kc × area_m2
    base_need = et0 * kc * area_m2

    # Adjust for existing soil moisture (less water needed if soil is wet)
    moisture_factor = max(0.2, 1.0 - soil_moisture)

    # Subtract recent rainfall contribution (mm × m² = litres)
    rainfall_contribution = rainfall * area_m2 / 1000.0  # mm to litres per m²

    estimated = max(0.0, (base_need * moisture_factor) - rainfall_contribution)
    return round(estimated, 2)


# ---------------------------------------------------------------------------
# Health / Vegetation Index
# ---------------------------------------------------------------------------

_HEALTH_THRESHOLDS = [
    (0.0, 0.15, "critical"),
    (0.15, 0.30, "low"),
    (0.30, 0.50, "moderate"),
    (0.50, 0.70, "high"),
    (0.70, 1.01, "very_high"),
]


def compute_health_index(ndvi: float) -> str:
    """
    Map an NDVI value to a vegetation health category.

    Thresholds:
        0.00 – 0.15  → critical
        0.15 – 0.30  → low
        0.30 – 0.50  → moderate
        0.50 – 0.70  → high
        0.70 – 1.00  → very_high

    Args:
        ndvi: NDVI value in [0, 1].

    Returns:
        Vegetation health label string.
    """
    ndvi = max(0.0, min(1.0, ndvi))
    for low, high, label in _HEALTH_THRESHOLDS:
        if low <= ndvi < high:
            return label
    return "moderate"  # fallback


# ---------------------------------------------------------------------------
# Risk Level Assessment
# ---------------------------------------------------------------------------

def compute_risk_level(
    ndvi: float = 0.5,
    soil_moisture: float = 0.5,
    temperature: float = 25.0,
    rainfall: float = 5.0,
) -> str:
    """
    Compute a composite risk level for a land parcel.

    Higher risk when:
        - NDVI is low (poor vegetation)
        - Soil moisture is low (drought stress)
        - Temperature is extreme (> 40 or < 5)
        - Rainfall is very low

    Args:
        ndvi: NDVI value (0–1).
        soil_moisture: Soil moisture fraction (0–1).
        temperature: Temperature in °C.
        rainfall: Rainfall in mm.

    Returns:
        Risk level: "low", "medium", "high", or "critical".
    """
    score = 0.0

    # NDVI contribution (0–30 points)
    if ndvi < 0.15:
        score += 30
    elif ndvi < 0.30:
        score += 20
    elif ndvi < 0.50:
        score += 10

    # Soil moisture contribution (0–25 points)
    if soil_moisture < 0.10:
        score += 25
    elif soil_moisture < 0.20:
        score += 15
    elif soil_moisture < 0.35:
        score += 5

    # Temperature contribution (0–25 points)
    if temperature > 45 or temperature < 0:
        score += 25
    elif temperature > 40 or temperature < 5:
        score += 15
    elif temperature > 35:
        score += 5

    # Rainfall contribution (0–20 points)
    if rainfall < 0.5:
        score += 20
    elif rainfall < 2.0:
        score += 10
    elif rainfall < 5.0:
        score += 5

    # Map score to risk level
    if score >= 60:
        return "critical"
    elif score >= 35:
        return "high"
    elif score >= 15:
        return "medium"
    else:
        return "low"
