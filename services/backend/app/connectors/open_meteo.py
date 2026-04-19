"""
Open-Meteo public API — current conditions at exact coordinates.

Docs: https://open-meteo.com/en/docs
No API key required; respect fair use and rate limits in production.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"


def fetch_current_land_climate(latitude: float, longitude: float, timeout_seconds: float = 12.0) -> Optional[dict[str, Any]]:
    """
    Return a dict suitable for `land_climate` insertion keys:
    - temperature_celsius (float)
    - humidity_pct (float)
    - rainfall_mm (float, from precipitation)

    Returns None on HTTP error or missing payload.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": "UTC",
    }
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            resp = client.get(OPEN_METEO_FORECAST, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Open-Meteo request failed: %s", exc)
        return None

    current = data.get("current") or {}
    temp = current.get("temperature_2m")
    humidity = current.get("relative_humidity_2m")
    precip = current.get("precipitation")

    if temp is None and humidity is None and precip is None:
        logger.warning("Open-Meteo returned no usable current fields")
        return None

    out: dict[str, Any] = {}
    if temp is not None:
        out["temperature_celsius"] = float(temp)
    if humidity is not None:
        out["humidity_pct"] = float(humidity)
    if precip is not None:
        out["rainfall_mm"] = float(precip)
    return out
