"""
pipeline/data_validation.py
----------------------------
Schema and range validation for incoming data.

Validates:
- Required fields exist and are non-empty
- Data types are correct
- Values are within acceptable ranges

Returns validated records and a list of validation errors.
"""

from typing import List, Dict, Any, Tuple


# Acceptable ranges for climate data
YEAR_MIN = 1900
YEAR_MAX = 2100
TEMP_MIN = -50.0   # °C — extreme cold
TEMP_MAX = 65.0    # °C — extreme heat
HUMIDITY_MIN = 0.0
HUMIDITY_MAX = 100.0


def validate_climate_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a single climate record.

    Args:
        record: Dictionary with keys: governorate, year, temperature_mean, humidity_pct.
        row_index: Row number in the source data (for error reporting).

    Returns:
        List of error messages. Empty list means the record is valid.
    """
    errors = []

    # --- governorate ---
    gov = record.get("governorate")
    if not gov or not isinstance(gov, str) or not gov.strip():
        errors.append(f"Row {row_index}: governorate is missing or empty.")

    # --- year ---
    year = record.get("year")
    if year is None:
        errors.append(f"Row {row_index}: year is missing.")
    elif not isinstance(year, int):
        errors.append(f"Row {row_index}: year must be an integer, got {type(year).__name__}.")
    elif year < YEAR_MIN or year > YEAR_MAX:
        errors.append(f"Row {row_index}: year {year} is out of range [{YEAR_MIN}, {YEAR_MAX}].")

    # --- temperature_mean ---
    temp = record.get("temperature_mean")
    if temp is None:
        errors.append(f"Row {row_index}: temperature_mean is missing.")
    elif not isinstance(temp, (int, float)):
        errors.append(f"Row {row_index}: temperature_mean must be numeric, got {type(temp).__name__}.")
    elif temp < TEMP_MIN or temp > TEMP_MAX:
        errors.append(f"Row {row_index}: temperature_mean {temp} is out of range [{TEMP_MIN}, {TEMP_MAX}].")

    # --- humidity_pct ---
    hum = record.get("humidity_pct")
    if hum is None:
        errors.append(f"Row {row_index}: humidity_pct is missing.")
    elif not isinstance(hum, (int, float)):
        errors.append(f"Row {row_index}: humidity_pct must be numeric, got {type(hum).__name__}.")
    elif hum < HUMIDITY_MIN or hum > HUMIDITY_MAX:
        errors.append(f"Row {row_index}: humidity_pct {hum} is out of range [{HUMIDITY_MIN}, {HUMIDITY_MAX}].")

    return errors


def validate_climate_batch(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Validate a batch of climate records.

    Args:
        records: List of parsed climate dictionaries.

    Returns:
        Tuple of (valid_records, invalid_records).
        Each invalid_record is: {"record": original_dict, "errors": [error_messages]}
    """
    valid = []
    invalid = []

    for i, record in enumerate(records, start=1):
        errors = validate_climate_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)

    return valid, invalid


# Acceptable ranges for water data
WATER_MIN = 0.0
WATER_MAX = 50000.0  # m³ per feddan
VALID_IRRIGATION_TYPES = {"flood", "drip", "sprinkler", "furrow"}


def validate_water_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a single water record.

    Args:
        record: Dictionary with keys: governorate, crop, year, water_consumption_m3, irrigation_type.
        row_index: Row number in the source data (for error reporting).

    Returns:
        List of error messages. Empty list means the record is valid.
    """
    errors = []

    # --- governorate ---
    gov = record.get("governorate")
    if not gov or not isinstance(gov, str) or not gov.strip():
        errors.append(f"Row {row_index}: governorate is missing or empty.")

    # --- crop ---
    crop = record.get("crop")
    if not crop or not isinstance(crop, str) or not crop.strip():
        errors.append(f"Row {row_index}: crop is missing or empty.")

    # --- year ---
    year = record.get("year")
    if year is None:
        errors.append(f"Row {row_index}: year is missing.")
    elif not isinstance(year, int):
        errors.append(f"Row {row_index}: year must be an integer, got {type(year).__name__}.")
    elif year < YEAR_MIN or year > YEAR_MAX:
        errors.append(f"Row {row_index}: year {year} is out of range [{YEAR_MIN}, {YEAR_MAX}].")

    # --- water_consumption_m3 ---
    water = record.get("water_consumption_m3")
    if water is None:
        errors.append(f"Row {row_index}: water_consumption_m3 is missing.")
    elif not isinstance(water, (int, float)):
        errors.append(f"Row {row_index}: water_consumption_m3 must be numeric, got {type(water).__name__}.")
    elif water < WATER_MIN or water > WATER_MAX:
        errors.append(f"Row {row_index}: water_consumption_m3 {water} is out of range [{WATER_MIN}, {WATER_MAX}].")

    # --- irrigation_type ---
    irr = record.get("irrigation_type")
    if irr and irr not in VALID_IRRIGATION_TYPES:
        errors.append(f"Row {row_index}: irrigation_type '{irr}' is not recognised.")

    return errors


def validate_water_batch(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Validate a batch of water records.

    Args:
        records: List of parsed water dictionaries.

    Returns:
        Tuple of (valid_records, invalid_records).
        Each invalid_record is: {"record": original_dict, "errors": [error_messages]}
    """
    valid = []
    invalid = []

    for i, record in enumerate(records, start=1):
        errors = validate_water_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)

    return valid, invalid


# ---------------------------------------------------------------------------
# Land Analytics Pipeline — Additional Validators
# ---------------------------------------------------------------------------

# Acceptable ranges for NDVI
NDVI_MIN = 0.0
NDVI_MAX = 1.0

# Acceptable ranges for soil moisture (fraction)
SOIL_MOISTURE_MIN = 0.0
SOIL_MOISTURE_MAX = 1.0

# Acceptable ranges for water need estimate (litres)
WATER_NEED_MIN = 0.0
WATER_NEED_MAX = 100000.0

# Acceptable ranges for rainfall (mm)
RAINFALL_MIN = 0.0
RAINFALL_MAX = 500.0

# Valid vegetation health labels
VALID_VEGETATION_HEALTH = {"critical", "low", "moderate", "high", "very_high"}

# Valid risk levels
VALID_RISK_LEVELS = {"low", "medium", "high", "critical"}


def validate_ndvi(ndvi_value: float, row_index: int) -> List[str]:
    """
    Validate a single NDVI value.

    Args:
        ndvi_value: Computed NDVI value.
        row_index: Row number for error reporting.

    Returns:
        List of error messages. Empty list means valid.
    """
    errors = []
    if ndvi_value is None:
        errors.append(f"Row {row_index}: ndvi is missing.")
    elif not isinstance(ndvi_value, (int, float)):
        errors.append(f"Row {row_index}: ndvi must be numeric, got {type(ndvi_value).__name__}.")
    elif ndvi_value < NDVI_MIN or ndvi_value > NDVI_MAX:
        errors.append(f"Row {row_index}: ndvi {ndvi_value} is out of range [{NDVI_MIN}, {NDVI_MAX}].")
    return errors


def validate_soil_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a single soil record.

    Args:
        record: Dictionary with keys: soil_moisture, soil_type, ph.
        row_index: Row number for error reporting.

    Returns:
        List of error messages. Empty list means valid.
    """
    errors = []

    moisture = record.get("soil_moisture")
    if moisture is None:
        errors.append(f"Row {row_index}: soil_moisture is missing.")
    elif not isinstance(moisture, (int, float)):
        errors.append(f"Row {row_index}: soil_moisture must be numeric, got {type(moisture).__name__}.")
    elif moisture < SOIL_MOISTURE_MIN or moisture > SOIL_MOISTURE_MAX:
        errors.append(f"Row {row_index}: soil_moisture {moisture} is out of range [{SOIL_MOISTURE_MIN}, {SOIL_MOISTURE_MAX}].")

    ph = record.get("ph")
    if ph is not None:
        if not isinstance(ph, (int, float)):
            errors.append(f"Row {row_index}: ph must be numeric, got {type(ph).__name__}.")
        elif ph < 0 or ph > 14:
            errors.append(f"Row {row_index}: ph {ph} is out of range [0, 14].")

    return errors


def validate_soil_batch(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate a batch of soil records."""
    valid = []
    invalid = []
    for i, record in enumerate(records, start=1):
        errors = validate_soil_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, invalid


def validate_crop_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a single crop record.

    Args:
        record: Dictionary with keys: governorate, crop_type, production_tons, area_feddan.
        row_index: Row number for error reporting.

    Returns:
        List of error messages. Empty list means valid.
    """
    errors = []

    gov = record.get("governorate")
    if not gov or not isinstance(gov, str) or not gov.strip():
        errors.append(f"Row {row_index}: governorate is missing or empty.")

    crop_type = record.get("crop_type")
    if not crop_type or not isinstance(crop_type, str) or not crop_type.strip():
        errors.append(f"Row {row_index}: crop_type is missing or empty.")

    production = record.get("production_tons")
    if production is not None:
        if not isinstance(production, (int, float)):
            errors.append(f"Row {row_index}: production_tons must be numeric.")
        elif production < 0:
            errors.append(f"Row {row_index}: production_tons {production} cannot be negative.")

    area = record.get("area_feddan")
    if area is not None:
        if not isinstance(area, (int, float)):
            errors.append(f"Row {row_index}: area_feddan must be numeric.")
        elif area < 0:
            errors.append(f"Row {row_index}: area_feddan {area} cannot be negative.")

    year = record.get("year")
    if year is not None:
        if not isinstance(year, int) or year < YEAR_MIN or year > YEAR_MAX:
            errors.append(f"Row {row_index}: year {year} is invalid.")

    return errors


def validate_crop_batch(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate a batch of crop records."""
    valid = []
    invalid = []
    for i, record in enumerate(records, start=1):
        errors = validate_crop_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, invalid


def validate_climate_api_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a single climate record from JSON API (land analytics pipeline).

    Uses temperature and rainfall fields (not temperature_mean / humidity_pct).

    Args:
        record: Dict with keys: temperature, rainfall, and optionally governorate.
        row_index: Row number for error reporting.

    Returns:
        List of error messages. Empty list means valid.
    """
    errors = []

    temp = record.get("temperature")
    if temp is None:
        errors.append(f"Row {row_index}: temperature is missing.")
    elif not isinstance(temp, (int, float)):
        errors.append(f"Row {row_index}: temperature must be numeric, got {type(temp).__name__}.")
    elif temp < TEMP_MIN or temp > TEMP_MAX:
        errors.append(f"Row {row_index}: temperature {temp} is out of range [{TEMP_MIN}, {TEMP_MAX}].")

    rainfall = record.get("rainfall")
    if rainfall is not None and isinstance(rainfall, (int, float)):
        if rainfall < RAINFALL_MIN or rainfall > RAINFALL_MAX:
            errors.append(f"Row {row_index}: rainfall {rainfall} is out of range [{RAINFALL_MIN}, {RAINFALL_MAX}].")

    return errors


def validate_climate_api_batch(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validate a batch of climate API records."""
    valid = []
    invalid = []
    for i, record in enumerate(records, start=1):
        errors = validate_climate_api_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, invalid


def validate_land_analytics_record(record: Dict[str, Any], row_index: int) -> List[str]:
    """
    Validate a fully merged land analytics record before DB storage.

    Checks all domain-specific ranges in a single pass:
        - temperature: TEMP_MIN to TEMP_MAX
        - rainfall: RAINFALL_MIN to RAINFALL_MAX
        - ndvi: 0 to 1
        - soil_moisture: 0 to 1
        - water_need_estimate: WATER_NEED_MIN to WATER_NEED_MAX
        - vegetation_health: must be a valid label
        - risk_level: must be a valid label

    Args:
        record: Merged analytics dict.
        row_index: Row number for error reporting.

    Returns:
        List of error messages. Empty list means valid.
    """
    errors = []

    # land_id is required
    land_id = record.get("land_id")
    if land_id is None:
        errors.append(f"Row {row_index}: land_id is missing.")

    # temperature
    temp = record.get("temperature")
    if temp is not None and isinstance(temp, (int, float)):
        if temp < TEMP_MIN or temp > TEMP_MAX:
            errors.append(f"Row {row_index}: temperature {temp} out of range.")

    # rainfall
    rainfall = record.get("rainfall")
    if rainfall is not None and isinstance(rainfall, (int, float)):
        if rainfall < RAINFALL_MIN or rainfall > RAINFALL_MAX:
            errors.append(f"Row {row_index}: rainfall {rainfall} out of range.")

    # ndvi
    ndvi = record.get("ndvi")
    if ndvi is not None and isinstance(ndvi, (int, float)):
        if ndvi < NDVI_MIN or ndvi > NDVI_MAX:
            errors.append(f"Row {row_index}: ndvi {ndvi} out of range [{NDVI_MIN}, {NDVI_MAX}].")

    # soil_moisture
    sm = record.get("soil_moisture")
    if sm is not None and isinstance(sm, (int, float)):
        if sm < SOIL_MOISTURE_MIN or sm > SOIL_MOISTURE_MAX:
            errors.append(f"Row {row_index}: soil_moisture {sm} out of range [{SOIL_MOISTURE_MIN}, {SOIL_MOISTURE_MAX}].")

    # water_need_estimate
    wn = record.get("water_need_estimate")
    if wn is not None and isinstance(wn, (int, float)):
        if wn < WATER_NEED_MIN or wn > WATER_NEED_MAX:
            errors.append(f"Row {row_index}: water_need_estimate {wn} out of range.")

    # vegetation_health
    vh = record.get("vegetation_health")
    if vh is not None and vh not in VALID_VEGETATION_HEALTH:
        errors.append(f"Row {row_index}: vegetation_health '{vh}' is not recognised.")

    # risk_level
    rl = record.get("risk_level")
    if rl is not None and rl not in VALID_RISK_LEVELS:
        errors.append(f"Row {row_index}: risk_level '{rl}' is not recognised.")

    return errors


def validate_land_analytics_batch(
    records: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Validate a batch of merged land analytics records.

    Returns:
        (valid_records, invalid_records)
    """
    valid = []
    invalid = []
    for i, record in enumerate(records, start=1):
        errors = validate_land_analytics_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, invalid

