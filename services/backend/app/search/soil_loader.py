"""
search/soil_loader.py
---------------------
Data connector for soil datasets.

Reads soil data from JSON files and raster sources.

This is the SOURCE CONNECTOR — it only fetches and returns raw data.
No cleaning, no DB writes.
"""

import json
import os
from typing import Any, Dict, List


_DATA_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__),
    os.pardir, os.pardir, os.pardir,
    "data", "soil",
))


def _resolve_data_dir() -> str:
    """Resolve the data/soil directory."""
    if os.path.isdir(_DATA_DIR):
        return _DATA_DIR

    project_root = os.getenv("PROJECT_ROOT", "")
    if project_root:
        alt = os.path.join(project_root, "data", "soil")
        if os.path.isdir(alt):
            return alt

    raise FileNotFoundError(
        f"Soil data directory not found at {_DATA_DIR}. "
        "Set PROJECT_ROOT or ensure data/soil/ exists."
    )


def load_soil_json(filepath: str) -> List[Dict[str, Any]]:
    """
    Load soil data from a JSON file.

    Expected format:
        [
            {
                "governorate": "Cairo",
                "latitude": 30.05,
                "longitude": 31.25,
                "soil_moisture": 0.28,
                "soil_type": "clay",
                "ph": 7.2
            },
            ...
        ]

    Args:
        filepath: Absolute path to the JSON file.

    Returns:
        List of soil records.

    Raises:
        FileNotFoundError: If file does not exist.
        ValueError: If format is invalid.
    """
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Soil data file not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data
    raise ValueError("Expected a JSON array of soil records.")


def load_soil_json_content(content: str) -> List[Dict[str, Any]]:
    """
    Parse soil data from a JSON string.

    Args:
        content: Raw JSON string.

    Returns:
        List of soil records.
    """
    data = json.loads(content)
    if isinstance(data, list):
        return data
    raise ValueError("Expected a JSON array of soil records.")


def list_available_soil_files() -> List[str]:
    """List all JSON files in the soil data directory."""
    try:
        data_dir = _resolve_data_dir()
    except FileNotFoundError:
        return []
    return [f for f in os.listdir(data_dir) if f.endswith(".json")]
