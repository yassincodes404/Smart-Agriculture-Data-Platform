# Data Pipeline Implementation Guide
**Date:** April 18, 2026  
**Author:** Yassin Tarek  
**Subject:** How to Add a New Data Source to the Platform  

---

## What This Document Is

This is a step-by-step engineering guide for anyone on the team who needs to add a new data source (water, crops, production, etc.) into the Smart Agriculture Data Platform.

We built the **climate data pipeline** as the first real working implementation. This guide explains exactly what was done, why each piece exists, and how to replicate the same pattern for any other data domain.

---

## The Architecture (Big Picture)

Every data pipeline in this system follows the same 6-step flow:

```
CSV File (data/csv/)
       ↓
  Source Connector (search/)        ← Step 1: Read raw data
       ↓
  Parser (ingestion/loaders.py)     ← Step 2: Convert CSV text → Python dicts
       ↓
  Cleaner (pipeline/data_cleaning)  ← Step 3: Normalise names, fix types
       ↓
  Validator (pipeline/data_validation) ← Step 4: Range checks, required fields
       ↓
  Storage (ingestion/repository)    ← Step 5: Write to database
       ↓
  Batch Tracker (ingestion_batches) ← Step 6: Track success/failure
```

Each step is a **separate file** with a **single responsibility**. This means you can test, debug, or replace any step independently.

---

## The Files We Created for Climate

Here is every file involved in the climate pipeline, in the order data flows through them:

| # | File | Role | What It Does |
|---|------|------|-------------|
| 1 | `data/csv/egypt_governorate_climate_5yr.csv` | **Raw Data** | The actual CSV dataset. 27 Egyptian governorates × 5 years (2019–2023), with temperature and humidity columns. |
| 2 | `app/search/climate_loader.py` | **Source Connector** | Reads the CSV file from disk. Returns either raw text or parsed list of dicts. This is the only file that touches the filesystem. |
| 3 | `app/ingestion/loaders.py` | **Parser** | Takes raw CSV text string → splits into valid and invalid records. Catches per-row parse errors (bad numbers, empty fields). |
| 4 | `app/pipeline/data_cleaning.py` | **Cleaner** | Normalises governorate name variants (e.g., "el cairo" → "Cairo", "alex" → "Alexandria"). Ensures correct types (str→int, str→float). |
| 5 | `app/pipeline/data_validation.py` | **Validator** | Checks value ranges: year must be 1900–2100, temperature must be -50°C to 65°C, humidity must be 0–100%. Separates valid from invalid records. |
| 6 | `app/ingestion/repository.py` | **Storage** | Writes to database: creates Location rows, creates ClimateRecord rows, logs errors to EtlError table, manages IngestionBatch lifecycle. |
| 7 | `app/pipeline/climate_pipeline.py` | **Orchestrator** | The main entry point. Calls steps 2→3→4→5→6 in sequence. Handles errors at each step. Returns a results summary dict. |
| 8 | `app/api/pipeline.py` | **API Endpoint** | HTTP interface to trigger the pipeline (`POST /api/v1/pipeline/climate/run`). Thin layer — just calls the orchestrator. |
| 9 | `app/tests/pipeline/test_climate_pipeline.py` | **Tests** | 25 tests covering cleaning, validation, full pipeline integration, error handling, idempotency, and API endpoints. |

---

## How to Add a New Data Source (e.g., Water)

Follow these exact steps. Copy the climate files and modify them.

---

### Step 1: Prepare Your Raw Data

Create your CSV file and place it in:

```
data/csv/egypt_crop_water_use.csv
```

**Rules:**
- First row must be column headers
- Use consistent column names (lowercase, underscored)
- One record per row

**Example for water data:**
```csv
governorate,crop,year,water_consumption_m3,irrigation_type
Cairo,Wheat,2023,4500,flood
Giza,Rice,2023,8200,flood
Alexandria,Cotton,2023,5100,drip
```

---

### Step 2: Create the Database Model

Create `app/models/water_record.py`:

```python
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DECIMAL, String, DateTime, ForeignKey, UniqueConstraint
from app.models.user import Base

def _utcnow():
    return datetime.now(timezone.utc)

class WaterRecord(Base):
    __tablename__ = "water_records"

    water_record_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=False)
    crop = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    water_consumption_m3 = Column(DECIMAL(12, 2), nullable=True)
    irrigation_type = Column(String(50), nullable=True)
    batch_id = Column(Integer, ForeignKey("ingestion_batches.batch_id"), nullable=False)
    source_system = Column(String(100), nullable=False)
    ingestion_timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('location_id', 'crop', 'year', 'batch_id',
                         name='uq_water_location_crop_year_batch'),
    )
```

**Then register it in `app/db/base.py`:**
```python
from app.models.water_record import WaterRecord  # noqa: F401
```

> **Key point:** The `Location` and `IngestionBatch` models already exist and are shared across all domains. You do NOT recreate them. Your new model just references them via ForeignKey.

---

### Step 3: Create the Source Connector

Create `app/search/water_loader.py`:

```python
"""
Reads water CSV files from data/csv/ directory.
"""
import os
import csv
from io import StringIO
from typing import List, Dict, Any

_DATA_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__),
    os.pardir, os.pardir, os.pardir,
    "data", "csv"
))

def load_water_csv(filename: str = "egypt_crop_water_use.csv") -> str:
    filepath = os.path.join(_DATA_DIR, filename)
    if not os.path.isfile(filepath):
        raise FileNotFoundError(f"Water data file not found: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def load_water_records(filename: str = "egypt_crop_water_use.csv") -> List[Dict[str, Any]]:
    content = load_water_csv(filename)
    reader = csv.DictReader(StringIO(content))
    
    required = {"governorate", "crop", "year", "water_consumption_m3", "irrigation_type"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise ValueError(f"Missing required columns. Expected: {required}")
    
    records = []
    for row in reader:
        records.append({
            "governorate": row["governorate"].strip(),
            "crop": row["crop"].strip(),
            "year": int(row["year"]),
            "water_consumption_m3": float(row["water_consumption_m3"]),
            "irrigation_type": row["irrigation_type"].strip(),
        })
    return records
```

> **Pattern:** One loader per data source. It only reads from disk. No database logic. No cleaning logic.

---

### Step 4: Add the Parser to Loaders

Add a new function in `app/ingestion/loaders.py`:

```python
def parse_water_csv(content: str):
    """
    Parses water CSV content.
    Returns: (valid_records, invalid_records)
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
                "governorate": gov, "crop": crop, "year": year,
                "water_consumption_m3": water, "irrigation_type": irrigation,
            })
        except Exception as e:
            invalid_records.append({"record": str(row), "error": str(e)})
            
    return valid_records, invalid_records
```

---

### Step 5: Add Cleaning Rules

Add water-specific cleaning in `app/pipeline/data_cleaning.py`:

```python
# Known irrigation type aliases
_IRRIGATION_ALIASES = {
    "drip irrigation": "drip",
    "flood irrigation": "flood",
    "sprinkler irrigation": "sprinkler",
    "pivot": "sprinkler",
}

def clean_water_record(record: dict) -> dict:
    cleaned = {}
    cleaned["governorate"] = normalise_governorate(str(record["governorate"]))
    cleaned["crop"] = record["crop"].strip().title()
    cleaned["year"] = int(record["year"])
    cleaned["water_consumption_m3"] = float(record["water_consumption_m3"])
    
    raw_irr = record.get("irrigation_type", "").strip().lower()
    cleaned["irrigation_type"] = _IRRIGATION_ALIASES.get(raw_irr, raw_irr)
    
    return cleaned

def clean_water_batch(records):
    return [clean_water_record(r) for r in records]
```

> **Important:** The `normalise_governorate()` function is SHARED. All domains reuse it because governorate names come from the same source country. You don't rewrite it.

---

### Step 6: Add Validation Rules

Add water-specific validation in `app/pipeline/data_validation.py`:

```python
WATER_MIN = 0.0
WATER_MAX = 50000.0  # m³ per feddan
VALID_IRRIGATION_TYPES = {"flood", "drip", "sprinkler", "furrow"}

def validate_water_record(record: dict, row_index: int) -> list:
    errors = []
    
    gov = record.get("governorate")
    if not gov or not isinstance(gov, str) or not gov.strip():
        errors.append(f"Row {row_index}: governorate is missing or empty.")
    
    crop = record.get("crop")
    if not crop or not isinstance(crop, str) or not crop.strip():
        errors.append(f"Row {row_index}: crop is missing or empty.")
    
    year = record.get("year")
    if year is None:
        errors.append(f"Row {row_index}: year is missing.")
    elif not isinstance(year, int) or year < YEAR_MIN or year > YEAR_MAX:
        errors.append(f"Row {row_index}: year {year} is invalid.")
    
    water = record.get("water_consumption_m3")
    if water is None:
        errors.append(f"Row {row_index}: water_consumption_m3 is missing.")
    elif not isinstance(water, (int, float)) or water < WATER_MIN or water > WATER_MAX:
        errors.append(f"Row {row_index}: water_consumption_m3 {water} out of range.")
    
    irr = record.get("irrigation_type")
    if irr and irr not in VALID_IRRIGATION_TYPES:
        errors.append(f"Row {row_index}: irrigation_type '{irr}' is not recognised.")
    
    return errors

def validate_water_batch(records):
    valid, invalid = [], []
    for i, record in enumerate(records, start=1):
        errors = validate_water_record(record, i)
        if errors:
            invalid.append({"record": record, "errors": errors})
        else:
            valid.append(record)
    return valid, invalid
```

---

### Step 7: Add Storage Functions to Repository

Add to `app/ingestion/repository.py`:

```python
from app.models.water_record import WaterRecord

def insert_water_record(db, record_data, batch_id, location_id):
    try:
        record = WaterRecord(
            location_id=location_id,
            crop=record_data["crop"],
            year=record_data["year"],
            water_consumption_m3=record_data["water_consumption_m3"],
            irrigation_type=record_data["irrigation_type"],
            batch_id=batch_id,
            source_system="CSV_File_Pipeline",
            ingestion_timestamp=_utcnow(),
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        log_error(db, batch_id, "DB_INSERT", str(e), str(record_data))
        raise e
```

> **Reuse:** `create_batch()`, `mark_batch_completed()`, `log_error()`, `get_or_create_location()` are all shared. You don't rewrite them.

---

### Step 8: Create the Pipeline Orchestrator

Create `app/pipeline/water_pipeline.py` — copy `climate_pipeline.py` and change the domain-specific parts:

```python
from app.search.water_loader import load_water_csv, load_water_records
from app.pipeline.data_cleaning import clean_water_batch
from app.pipeline.data_validation import validate_water_batch
from app.ingestion.repository import (
    create_batch, mark_batch_completed, log_error,
    get_or_create_location, insert_water_record,
)

def run_water_ingestion(db, filename="egypt_crop_water_use.csv", source_system="CSV_File_Pipeline"):
    batch = create_batch(db, source_system=source_system)
    batch_id = batch.batch_id
    
    try:
        parsed = load_water_records(filename)
        cleaned = clean_water_batch(parsed)
        valid, invalid = validate_water_batch(cleaned)
        
        # Log errors for invalid records
        error_count = 0
        for inv in invalid:
            for err in inv["errors"]:
                log_error(db, batch_id, "VALIDATION", err, str(inv["record"]))
                error_count += 1
        
        # Store valid records
        inserted_count = 0
        for record in valid:
            loc = get_or_create_location(db, record["governorate"])
            try:
                insert_water_record(db, record, batch_id, loc.location_id)
                inserted_count += 1
            except:
                error_count += 1
        
        # Determine status
        if error_count == 0 and inserted_count > 0:
            status = "COMPLETED"
        elif inserted_count > 0:
            status = "PARTIAL_SUCCESS"
        else:
            status = "FAILED"
        
        mark_batch_completed(db, batch_id, status)
        
        return {
            "batch_id": batch_id,
            "inserted_count": inserted_count,
            "error_count": error_count,
            "status": status,
        }
    except Exception as e:
        log_error(db, batch_id, "UNKNOWN_ERROR", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        raise
```

---

### Step 9: Add the API Endpoint

Add a new route in `app/api/pipeline.py`:

```python
from app.pipeline.water_pipeline import run_water_ingestion

@router.post("/water/run", status_code=status.HTTP_201_CREATED)
def trigger_water_pipeline(
    filename: str = Query("egypt_crop_water_use.csv"),
    db: Session = Depends(get_db),
):
    try:
        result = run_water_ingestion(db, filename=filename)
        return {"status": "success", "data": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
```

---

### Step 10: Write the Tests

Create `app/tests/pipeline/test_water_pipeline.py` — follow the exact same structure as `test_climate_pipeline.py`:

```
TestDataCleaning         → test cleaning functions in isolation
TestDataValidation       → test validation functions in isolation
TestPipelineIntegration  → test full pipeline with test DB
TestPipelineAPI          → test HTTP endpoints with TestClient
```

**Minimum tests you must write:**
1. Valid CSV → all records inserted → status COMPLETED
2. Mixed valid/invalid → partial insert → status PARTIAL_SUCCESS
3. All invalid → nothing inserted → status FAILED
4. Missing columns → ValueError raised
5. Batch record created and status updated
6. Errors logged to etl_errors table
7. Cleaning rules actually applied (check DB values)
8. Run pipeline twice → duplicates handled cleanly

---

## What Is Shared vs. What Is Domain-Specific

This is critical to understand. Some code is **shared infrastructure** and some is **written per domain**.

### Shared (DO NOT duplicate)

| Component | File | Why Shared |
|-----------|------|-----------|
| Location model | `models/location.py` | All data domains reference Egyptian governorates |
| IngestionBatch model | `models/ingestion_batch.py` | All pipelines track batches the same way |
| EtlError model | `models/etl_error.py` | All pipelines log errors the same way |
| Batch functions | `ingestion/repository.py` → `create_batch()`, `mark_batch_completed()`, `log_error()`, `get_or_create_location()` | Same lifecycle logic for every pipeline |
| Governorate normalisation | `pipeline/data_cleaning.py` → `normalise_governorate()` | Same country, same governorate names |
| Test fixtures | `tests/conftest.py` → `db_session`, `client` | Same test database setup |

### Domain-Specific (create new for each source)

| Component | Climate Example | Water Example |
|-----------|----------------|--------------|
| Raw CSV | `data/csv/egypt_governorate_climate_5yr.csv` | `data/csv/egypt_crop_water_use.csv` |
| DB Model | `models/climate_record.py` | `models/water_record.py` |
| Source Connector | `search/climate_loader.py` | `search/water_loader.py` |
| Parser | `ingestion/loaders.py` → `parse_climate_csv()` | `ingestion/loaders.py` → `parse_water_csv()` |
| Cleaner | `pipeline/data_cleaning.py` → `clean_climate_*` | `pipeline/data_cleaning.py` → `clean_water_*` |
| Validator | `pipeline/data_validation.py` → `validate_climate_*` | `pipeline/data_validation.py` → `validate_water_*` |
| DB Insert | `ingestion/repository.py` → `insert_climate_record()` | `ingestion/repository.py` → `insert_water_record()` |
| Orchestrator | `pipeline/climate_pipeline.py` | `pipeline/water_pipeline.py` |
| API Route | `api/pipeline.py` → `/pipeline/climate/run` | `api/pipeline.py` → `/pipeline/water/run` |
| Tests | `tests/pipeline/test_climate_pipeline.py` | `tests/pipeline/test_water_pipeline.py` |

---

## Checklist for Adding a New Data Source

Use this as a literal checklist:

```
[ ] 1. CSV file placed in data/csv/
[ ] 2. Database model created in models/
[ ] 3. Model registered in db/base.py
[ ] 4. Source connector created in search/
[ ] 5. Parser function added to ingestion/loaders.py
[ ] 6. Cleaning function added to pipeline/data_cleaning.py
[ ] 7. Validation function added to pipeline/data_validation.py
[ ] 8. Insert function added to ingestion/repository.py
[ ] 9. Pipeline orchestrator created in pipeline/
[ ] 10. API endpoint added to api/pipeline.py
[ ] 11. Tests written and all passing
[ ] 12. Run full test suite — no regressions
```

---

## Current Test Results

After implementing the climate pipeline, the full test suite shows:

```
95 passed, 0 failed

Breakdown:
├── tests/ai/test_prediction.py       →  1 test
├── tests/api/test_auth.py            → 29 tests
├── tests/api/test_climate.py         →  6 tests
├── tests/api/test_health.py          →  6 tests
├── tests/api/test_users.py           → 25 tests
├── tests/models/test_user.py         →  1 test ─── (pre-existing)
├── tests/users/test_security.py      →  2 tests
└── tests/pipeline/test_climate_pipeline.py → 25 tests ← NEW
```

---

## API Endpoints Available After Pipeline Setup

```
POST  /api/v1/pipeline/climate/run           → Run climate pipeline from CSV file
GET   /api/v1/pipeline/climate/files         → List available CSV files
GET   /api/v1/pipeline/climate/status/{id}   → Check batch status

POST  /api/v1/ingestion/climate/upload       → Upload CSV via HTTP (existing)
GET   /api/v1/climate/records                → Query stored climate data (existing)
```

---

## Upcoming Data Sources (from architecture docs)

| Domain | CSV File Needed | Model Name |
|--------|----------------|------------|
| Water | `egypt_crop_water_use.csv` | `WaterRecord` |
| Crop Production | `egypt_crop_production.csv` | `CropProductionRecord` |
| Area/Land | `egypt_cultivated_area.csv` | `AreaRecord` |

All follow the exact same pattern described above.
