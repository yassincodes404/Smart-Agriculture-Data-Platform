"""
ingestion/loaders.py
--------------------
Parsers and loaders for ingestion files.
"""

import csv
from io import StringIO
from typing import List, Dict, Any, Tuple

def parse_climate_csv(content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses climate CSV content.
    Returns: (valid_records, invalid_records)
    where invalid_records contains {"record": row, "error": msg}
    """
    reader = csv.DictReader(StringIO(content))
    valid_records = []
    invalid_records = []
    
    required_cols = {"governorate", "year", "temperature_mean", "humidity_pct"}
    
    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise ValueError(f"Missing required columns. Expected: {required_cols}")

    for i, row in enumerate(reader):
        try:
            year = int(row["year"])
            temp = float(row["temperature_mean"])
            humidity = float(row["humidity_pct"])
            gov = row["governorate"].strip()
            
            if not gov:
                raise ValueError("Governorate is empty")
                
            valid_records.append({
                "governorate": gov,
                "year": year,
                "temperature_mean": temp,
                "humidity_pct": humidity
            })
        except Exception as e:
            invalid_records.append({
                "record": str(row),
                "error": str(e)
            })
            
    return valid_records, invalid_records


def parse_water_csv(content: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses water CSV content.
    Returns: (valid_records, invalid_records)
    where invalid_records contains {"record": row, "error": msg}
    """
    reader = csv.DictReader(StringIO(content))
    valid_records = []
    invalid_records = []
    
    required_cols = {"governorate", "crop", "year", "water_consumption_m3", "irrigation_type"}
    
    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise ValueError(f"Missing required columns. Expected: {required_cols}")

    for i, row in enumerate(reader):
        try:
            gov = row["governorate"].strip()
            crop = row["crop"].strip()
            year = int(row["year"])
            water = float(row["water_consumption_m3"])
            irrigation = row["irrigation_type"].strip()
            
            if not gov:
                raise ValueError("Governorate is empty")
            if not crop:
                raise ValueError("Crop is empty")
                
            valid_records.append({
                "governorate": gov,
                "crop": crop,
                "year": year,
                "water_consumption_m3": water,
                "irrigation_type": irrigation
            })
        except Exception as e:
            invalid_records.append({
                "record": str(row),
                "error": str(e)
            })
            
    return valid_records, invalid_records


# ---------------------------------------------------------------------------
# Land Analytics Pipeline — Additional Parsers
# ---------------------------------------------------------------------------

def parse_climate_json(data: list) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parse climate data from JSON API response.

    Expected input: list of dicts with keys:
        governorate, latitude, longitude, temperature, rainfall, year

    Returns:
        (valid_records, invalid_records)
    """
    valid_records: List[Dict[str, Any]] = []
    invalid_records: List[Dict[str, Any]] = []

    for i, item in enumerate(data):
        try:
            gov = str(item.get("governorate", "")).strip()
            if not gov:
                raise ValueError("governorate is empty")

            record: Dict[str, Any] = {
                "governorate": gov,
                "latitude": float(item.get("latitude", 0)),
                "longitude": float(item.get("longitude", 0)),
                "temperature": float(item["temperature"]),
                "rainfall": float(item.get("rainfall", 0.0)),
            }
            if "year" in item:
                record["year"] = int(item["year"])
            if "land_id" in item:
                record["land_id"] = int(item["land_id"])

            valid_records.append(record)
        except Exception as e:
            invalid_records.append({"record": str(item), "error": str(e)})

    return valid_records, invalid_records


def parse_netcdf(data: list) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parse pre-extracted NetCDF grid points into structured records.

    Expects a list of dicts (already extracted from the time × lat × lon grid)
    with keys: latitude, longitude, temperature, rainfall, timestamp

    Raw NetCDF file reading is done by feature_engineering.extract_netcdf_by_location().

    Returns:
        (valid_records, invalid_records)
    """
    valid_records: List[Dict[str, Any]] = []
    invalid_records: List[Dict[str, Any]] = []

    for i, item in enumerate(data):
        try:
            lat = float(item["latitude"])
            lon = float(item["longitude"])
            temp = float(item.get("temperature", 0.0))
            rain = float(item.get("rainfall", 0.0))

            record: Dict[str, Any] = {
                "latitude": lat,
                "longitude": lon,
                "temperature": temp,
                "rainfall": rain,
            }
            if "timestamp" in item:
                record["timestamp"] = str(item["timestamp"])
            if "land_id" in item:
                record["land_id"] = int(item["land_id"])

            valid_records.append(record)
        except Exception as e:
            invalid_records.append({"record": str(item), "error": str(e)})

    return valid_records, invalid_records


def parse_csv_generic(
    content: str,
    required_cols: set,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Generic CSV parser — works for any domain.

    Reads a CSV string, validates that required columns exist,
    and returns each row as a plain dict.

    Args:
        content: Raw CSV string.
        required_cols: Set of column names that must be present.

    Returns:
        (valid_records, invalid_records)
    """
    reader = csv.DictReader(StringIO(content))
    valid_records: List[Dict[str, Any]] = []
    invalid_records: List[Dict[str, Any]] = []

    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise ValueError(f"Missing required columns. Expected: {required_cols}")

    for i, row in enumerate(reader):
        try:
            record = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
            valid_records.append(record)
        except Exception as e:
            invalid_records.append({"record": str(row), "error": str(e)})

    return valid_records, invalid_records


def parse_soil_json(data: list) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parse soil data from JSON payload.

    Expected input: list of dicts with keys:
        governorate, soil_moisture, soil_type, ph, latitude, longitude

    Returns:
        (valid_records, invalid_records)
    """
    valid_records: List[Dict[str, Any]] = []
    invalid_records: List[Dict[str, Any]] = []

    for i, item in enumerate(data):
        try:
            gov = str(item.get("governorate", "")).strip()
            soil_moisture = float(item["soil_moisture"])

            record: Dict[str, Any] = {
                "governorate": gov,
                "soil_moisture": soil_moisture,
                "soil_type": str(item.get("soil_type", "")).strip(),
                "ph": float(item.get("ph", 7.0)),
            }
            if "latitude" in item:
                record["latitude"] = float(item["latitude"])
            if "longitude" in item:
                record["longitude"] = float(item["longitude"])
            if "land_id" in item:
                record["land_id"] = int(item["land_id"])

            valid_records.append(record)
        except Exception as e:
            invalid_records.append({"record": str(item), "error": str(e)})

    return valid_records, invalid_records

