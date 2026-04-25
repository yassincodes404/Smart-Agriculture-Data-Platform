"""
search/crop_loader.py
---------------------
Data connector for crop production datasets.

Reads crop CSV files from the local data/csv/ directory
and returns structured data ready for the ingestion pipeline.

This is the SOURCE CONNECTOR — it only fetches and returns raw data.
No cleaning, no DB writes.
"""

import csv
import os
from io import StringIO
from typing import Any, Dict, List


# Base path to the raw CSV data directory
_DATA_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__),
    os.pardir, os.pardir, os.pardir,
    "data", "csv",
))


def _resolve_data_dir() -> str:
    """Resolve the data/csv directory."""
    if os.path.isdir(_DATA_DIR):
        return _DATA_DIR

    project_root = os.getenv("PROJECT_ROOT", "")
    if project_root:
        alt = os.path.join(project_root, "data", "csv")
        if os.path.isdir(alt):
            return alt

    raise FileNotFoundError(
        f"Data directory not found at {_DATA_DIR}. "
        "Set PROJECT_ROOT or ensure data/csv/ exists."
    )


def load_crop_csv(filename: str = "egypt_crop_production.csv") -> str:
    """
    Load a crop CSV file and return its raw content.

    Args:
        filename: Name of the CSV file inside data/csv/.

    Returns:
        Raw CSV string content.

    Raises:
        FileNotFoundError: If the file does not exist.
    """
    data_dir = _resolve_data_dir()
    filepath = os.path.join(data_dir, filename)

    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Crop data file not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def load_crop_records(filename: str = "egypt_crop_production.csv") -> List[Dict[str, Any]]:
    """
    Load and parse a crop CSV file into a list of dictionaries.

    Expected columns:
        governorate, crop_type, year, production_tons, area_feddan

    Args:
        filename: Name of the CSV file inside data/csv/.

    Returns:
        List of parsed records.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If required columns are missing.
    """
    content = load_crop_csv(filename)
    reader = csv.DictReader(StringIO(content))

    required_cols = {"governorate", "crop_type", "year", "production_tons", "area_feddan"}
    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        raise ValueError(
            f"CSV is missing required columns. "
            f"Expected: {required_cols}, Got: {reader.fieldnames}"
        )

    records: List[Dict[str, Any]] = []
    for row in reader:
        records.append({
            "governorate": row["governorate"].strip(),
            "crop_type": row["crop_type"].strip(),
            "year": int(row["year"]),
            "production_tons": float(row["production_tons"]),
            "area_feddan": float(row["area_feddan"]),
        })
    return records


def list_available_files() -> List[str]:
    """List all CSV files available in the data directory."""
    try:
        data_dir = _resolve_data_dir()
    except FileNotFoundError:
        return []
    return [f for f in os.listdir(data_dir) if f.endswith(".csv")]
