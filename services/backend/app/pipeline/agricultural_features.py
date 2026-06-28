"""
pipeline/agricultural_features.py
-----------------------------------
Non-CV agricultural feature engineering for the main data pipeline.

This layer sits AFTER the analytics pipeline and BEFORE the prediction layer.
It produces ML-ready derived features from clean, validated domain data.

What this IS:
    - Derived numerical features for ML model input
    - Aggregated metrics computed from domain tables

What this is NOT:
    - Cleaning or validation (those belong to earlier layers)
    - ML model inference (that belongs to ai/models/)
    - Computer Vision features (those belong to pipeline/feature_engineering.py)

Input:  Cleaned domain tables (climate_records, water_records,
        crop_production_records, analytics_summary)
Output: Feature rows stored in the analytics_summary table or a
        dedicated feature store.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature: Yield per Hectare
# ---------------------------------------------------------------------------

# 1 feddan = 0.420168 hectares
_FEDDAN_TO_HECTARE: float = 0.420168


def compute_yield_per_hectare(
    production_tons: float,
    area_feddan: float,
) -> Optional[float]:
    """
    Compute crop yield per hectare.

    Formula: yield_per_ha = production_tons / (area_feddan × 0.420168)

    Args:
        production_tons: Total crop production in tonnes.
        area_feddan: Cultivated area in feddans.

    Returns:
        Yield in tonnes/hectare, or None if area is zero.
    """
    if area_feddan <= 0:
        logger.warning(
            f"compute_yield_per_hectare: area_feddan={area_feddan} is zero or negative."
        )
        return None

    area_ha = area_feddan * _FEDDAN_TO_HECTARE
    result = production_tons / area_ha
    return round(result, 4)


def compute_yield_per_hectare_batch(
    records: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute yield_per_hectare for a batch of crop records.

    Each record must contain 'production_tons' and 'area_feddan'.
    The computed field 'yield_per_hectare' is added in-place to each record.

    Args:
        records: List of crop production record dicts.

    Returns:
        Same list with 'yield_per_hectare' added to each record.
    """
    for record in records:
        prod = record.get("production_tons", 0.0)
        area = record.get("area_feddan", 0.0)
        record["yield_per_hectare"] = compute_yield_per_hectare(
            float(prod), float(area)
        )
    return records


# ---------------------------------------------------------------------------
# Feature: Water Efficiency Index
# ---------------------------------------------------------------------------

def compute_water_efficiency(
    production_tons: float,
    water_m3: float,
) -> Optional[float]:
    """
    Compute water use efficiency.

    Formula: water_efficiency = production_tons / water_m3
    Interpretation: tonnes of crop produced per m³ of water used.

    Args:
        production_tons: Total crop production in tonnes.
        water_m3: Total water consumed in cubic metres.

    Returns:
        Water efficiency (tonnes/m³), or None if water_m3 is zero.
    """
    if water_m3 <= 0:
        logger.warning(
            f"compute_water_efficiency: water_m3={water_m3} is zero or negative."
        )
        return None

    result = production_tons / water_m3
    return round(result, 6)


def compute_water_efficiency_batch(
    records: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute water_efficiency_index for a batch of joined records.

    Each record must contain 'production_tons' and 'water_consumption_m3'.
    The computed field 'water_efficiency_index' is added to each record.

    Args:
        records: List of dicts with production and water fields.

    Returns:
        Same list with 'water_efficiency_index' added.
    """
    for record in records:
        prod = record.get("production_tons", 0.0)
        water = record.get("water_consumption_m3", 0.0)
        record["water_efficiency_index"] = compute_water_efficiency(
            float(prod), float(water)
        )
    return records


# ---------------------------------------------------------------------------
# Feature: Production Growth Rate
# ---------------------------------------------------------------------------

def compute_production_growth_rate(
    current_value: float,
    previous_value: float,
) -> Optional[float]:
    """
    Compute year-over-year production growth rate.

    Formula: growth_rate = (current - previous) / previous × 100

    Args:
        current_value: Production value for the current year.
        previous_value: Production value for the previous year.

    Returns:
        Growth rate as a percentage, or None if previous_value is zero.
    """
    if previous_value == 0:
        logger.warning(
            "compute_production_growth_rate: previous_value is zero — "
            "cannot compute growth rate."
        )
        return None

    rate = (current_value - previous_value) / previous_value * 100.0
    return round(rate, 4)


def compute_production_growth_batch(
    records: List[Dict[str, Any]],
    value_key: str = "production_tons",
    year_key: str = "year",
    group_keys: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Compute production_growth_rate for a batch sorted by year.

    Records are grouped by (governorate, crop_type) by default.
    Within each group, growth rate is computed between consecutive years.

    Args:
        records: List of crop production record dicts (must be pre-sorted by year).
        value_key: Field name of the production value.
        year_key: Field name of the year.
        group_keys: Fields to group by. Defaults to ['governorate', 'crop_type'].

    Returns:
        Same list with 'production_growth_rate' added to each record.
        First year in each group gets None (no previous year).
    """
    if group_keys is None:
        group_keys = ["governorate", "crop_type"]

    # Build previous-year lookup: (group_key_values, year) -> value
    prev_lookup: Dict[Any, float] = {}

    # First pass: sort and build lookup for each group
    sorted_records = sorted(records, key=lambda r: (
        tuple(str(r.get(k, "")) for k in group_keys),
        int(r.get(year_key, 0))
    ))

    for record in sorted_records:
        group = tuple(str(record.get(k, "")) for k in group_keys)
        year = int(record.get(year_key, 0))
        current_val = float(record.get(value_key, 0.0))
        prev_key = (group, year - 1)

        if prev_key in prev_lookup:
            record["production_growth_rate"] = compute_production_growth_rate(
                current_val, prev_lookup[prev_key]
            )
        else:
            record["production_growth_rate"] = None  # No previous year in dataset

        # Store current year's value for next iteration
        prev_lookup[(group, year)] = current_val

    return sorted_records


# ---------------------------------------------------------------------------
# Feature: Climate Stress Index
# ---------------------------------------------------------------------------

# Optimal climate ranges for Egyptian crops (simplified)
_OPTIMAL_TEMP_MIN: float = 18.0   # °C
_OPTIMAL_TEMP_MAX: float = 32.0   # °C
_OPTIMAL_HUMIDITY_MIN: float = 40.0  # %
_OPTIMAL_HUMIDITY_MAX: float = 70.0  # %


def compute_climate_stress_index(
    temperature: float,
    humidity_pct: float,
) -> float:
    """
    Compute a composite climate stress index for agricultural conditions.

    Score ranges from 0.0 (optimal) to 1.0 (extreme stress).
    Based on deviation from optimal temperature and humidity ranges
    for Egyptian agricultural crops.

    Components:
        - Temperature stress: deviation outside [18°C, 32°C]
        - Humidity stress:    deviation outside [40%, 70%]

    Args:
        temperature: Mean temperature in °C.
        humidity_pct: Humidity percentage (0–100).

    Returns:
        Climate stress index in [0.0, 1.0].
    """
    # Temperature stress (0–0.5 contribution)
    if temperature < _OPTIMAL_TEMP_MIN:
        temp_stress = min(0.5, (_OPTIMAL_TEMP_MIN - temperature) / 30.0)
    elif temperature > _OPTIMAL_TEMP_MAX:
        temp_stress = min(0.5, (temperature - _OPTIMAL_TEMP_MAX) / 30.0)
    else:
        temp_stress = 0.0

    # Humidity stress (0–0.5 contribution)
    if humidity_pct < _OPTIMAL_HUMIDITY_MIN:
        humidity_stress = min(0.5, (_OPTIMAL_HUMIDITY_MIN - humidity_pct) / 80.0)
    elif humidity_pct > _OPTIMAL_HUMIDITY_MAX:
        humidity_stress = min(0.5, (humidity_pct - _OPTIMAL_HUMIDITY_MAX) / 80.0)
    else:
        humidity_stress = 0.0

    index = round(temp_stress + humidity_stress, 4)
    return min(1.0, index)


def compute_climate_stress_batch(
    records: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute climate_stress_index for a batch of climate records.

    Each record must contain 'temperature_mean' and 'humidity_pct'.
    The computed field 'climate_stress_index' is added to each record.

    Args:
        records: List of climate record dicts.

    Returns:
        Same list with 'climate_stress_index' added.
    """
    for record in records:
        temp = record.get("temperature_mean", 25.0)
        humidity = record.get("humidity_pct", 55.0)
        record["climate_stress_index"] = compute_climate_stress_index(
            float(temp), float(humidity)
        )
    return records


# ---------------------------------------------------------------------------
# Composite: Build Full Feature Record
# ---------------------------------------------------------------------------

def build_feature_record(
    crop_record: Dict[str, Any],
    water_record: Optional[Dict[str, Any]] = None,
    climate_record: Optional[Dict[str, Any]] = None,
    previous_production: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Build a single ML-ready feature record by combining domain data.

    Computes all features from the available domain records:
        - yield_per_hectare
        - water_efficiency_index
        - production_growth_rate
        - climate_stress_index

    Args:
        crop_record: Cleaned crop production record.
        water_record: Cleaned water record for the same governorate/crop/year.
        climate_record: Cleaned climate record for the same governorate/year.
        previous_production: Production value from the prior year (for growth rate).

    Returns:
        Feature dict containing all original fields plus computed features.
    """
    feature = dict(crop_record)  # start with crop base fields

    production = float(crop_record.get("production_tons", 0.0))
    area = float(crop_record.get("area_feddan", 0.0))

    # Feature 1: Yield per hectare
    feature["yield_per_hectare"] = compute_yield_per_hectare(production, area)

    # Feature 2: Water efficiency index
    if water_record:
        water_m3 = float(water_record.get("water_consumption_m3", 0.0))
        feature["water_consumption_m3"] = water_m3
        feature["water_efficiency_index"] = compute_water_efficiency(production, water_m3)
    else:
        feature["water_consumption_m3"] = None
        feature["water_efficiency_index"] = None

    # Feature 3: Production growth rate
    if previous_production is not None:
        feature["production_growth_rate"] = compute_production_growth_rate(
            production, previous_production
        )
    else:
        feature["production_growth_rate"] = None

    # Feature 4: Climate stress index
    if climate_record:
        temp = float(climate_record.get("temperature_mean", 25.0))
        humidity = float(climate_record.get("humidity_pct", 55.0))
        feature["temperature_mean"] = temp
        feature["humidity_pct"] = humidity
        feature["climate_stress_index"] = compute_climate_stress_index(temp, humidity)
    else:
        feature["temperature_mean"] = None
        feature["humidity_pct"] = None
        feature["climate_stress_index"] = None

    return feature
