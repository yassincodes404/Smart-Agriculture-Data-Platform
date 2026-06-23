"""
connectors/soilgrids.py
-----------------------
ISRIC SoilGrids v2.0 REST API connector.

API docs:  https://rest.isric.org/soilgrids/v2.0/docs
Auth:      None required
License:   CC BY 4.0

Properties fetched (all at 3 topsoil depths: 0-5cm, 5-15cm, 15-30cm):
  phh2o   → pH (H₂O),  mapped pH×10  → divide by 10 → actual pH
  soc     → Soil Organic Carbon (dg/kg) → divide by 10 → g/kg
  clay    → Clay content (g/kg)  → divide by 10 → %
  sand    → Sand content (g/kg)  → divide by 10 → %
  silt    → Silt content (g/kg)  → divide by 10 → %
  bdod    → Bulk Density (cg/cm³) → divide by 100 → kg/dm³
  nitrogen→ Total N (cg/kg) → divide by 100 → g/kg
  cec     → Cation Exchange Capacity (mmol(c)/kg) → divide by 10 → cmol(c)/kg

Scale factors (d_factor) are read from the API response itself.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

ISRIC_BASE = "https://rest.isric.org/soilgrids/v2.0/properties/query"

PROPERTIES = ["phh2o", "soc", "clay", "sand", "silt", "bdod", "nitrogen", "cec"]
DEPTHS = ["0-5cm", "5-15cm", "15-30cm"]


def fetch_soil_profile(
    lat: float,
    lon: float,
    timeout: float = 25.0,
) -> Optional[dict[str, Any]]:
    """
    Fetch ISRIC SoilGrids soil property profile for a location.

    Returns a nested dict:
    {
      "lat": 30.5, "lon": 31.0,
      "properties": {
        "phh2o": {"0-5cm": 7.8, "5-15cm": 7.9, "15-30cm": 8.0},
        "clay":  {"0-5cm": 30.7, ...},
        "sand":  {"0-5cm": 42.1, ...},
        ...
      },
      "texture_class": "clay_loam",   # derived from sand/clay
      "source": "ISRIC-SoilGrids-v2"
    }

    Returns None if request fails or all values are null.
    """
    params: list[tuple[str, str]] = []
    params.append(("lon", str(lon)))
    params.append(("lat", str(lat)))
    for prop in PROPERTIES:
        params.append(("property", prop))
    for depth in DEPTHS:
        params.append(("depth", depth))
    params.append(("value", "mean"))

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(ISRIC_BASE, params=params, follow_redirects=True)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("SoilGrids request failed: %s", exc)
        return None

    layers = data.get("properties", {}).get("layers", [])
    if not layers:
        logger.warning("SoilGrids returned no layers for lat=%s lon=%s", lat, lon)
        return None

    result: dict[str, dict[str, Optional[float]]] = {}
    any_value = False

    for layer in layers:
        name = layer.get("name")
        d_factor = layer.get("unit_measure", {}).get("d_factor", 1) or 1
        if not name:
            continue
        depth_vals: dict[str, Optional[float]] = {}
        for depth_entry in layer.get("depths", []):
            label = depth_entry.get("label")
            raw = depth_entry.get("values", {}).get("mean")
            if label is None:
                continue
            if raw is not None:
                depth_vals[label] = round(raw / d_factor, 4)
                any_value = True
            else:
                depth_vals[label] = None
        result[name] = depth_vals

    if not any_value:
        logger.warning("SoilGrids all-null response for lat=%s lon=%s", lat, lon)
        return None

    # Derive texture class from topsoil sand + clay %
    texture = _texture_class(
        clay_pct=_top_value(result, "clay"),
        sand_pct=_top_value(result, "sand"),
    )

    return {
        "lat": lat,
        "lon": lon,
        "properties": result,
        "texture_class": texture,
        "source": "ISRIC-SoilGrids-v2",
    }


def _top_value(props: dict, name: str) -> Optional[float]:
    """Return the 0-5cm (topsoil) value for a property."""
    return props.get(name, {}).get("0-5cm")


def _texture_class(clay_pct: Optional[float], sand_pct: Optional[float]) -> str:
    """
    USDA soil texture triangle simplified to 6 classes.
    Thresholds are approximate and cover the major agricultural classes.
    """
    if clay_pct is None or sand_pct is None:
        return "unknown"
    silt_pct = max(0.0, 100.0 - clay_pct - sand_pct)

    if clay_pct >= 40:
        return "clay"
    elif clay_pct >= 27 and sand_pct < 45:
        return "clay_loam"
    elif clay_pct >= 20 and silt_pct >= 28:
        return "silty_clay_loam"
    elif sand_pct >= 70 and clay_pct < 15:
        return "sandy_loam"
    elif silt_pct >= 50:
        return "silt_loam"
    else:
        return "loam"
