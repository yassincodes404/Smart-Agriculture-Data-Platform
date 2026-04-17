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
