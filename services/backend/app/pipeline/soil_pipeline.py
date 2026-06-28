"""
pipeline/soil_pipeline.py
--------------------------
Central orchestration pipeline for soil data ingestion.

End-to-end flow (from 2026-04-18_Data_Pipeline_Guide.md):
    1. Source Connector  (search/soil_loader)         → load raw data
    2. Parse             (ingestion/loaders)           → structured dicts
    3. Clean             (pipeline/data_cleaning)      → normalise types
    4. Validate          (pipeline/data_validation)    → range checks, schema
    5. Store             (ingestion/repository)        → insert to DB
    6. Track             (ingestion_batches)           → batch status + errors

Single entry-point: run_soil_ingestion()
Can be called from:
    - API endpoint  (POST /api/v1/pipeline/soil/run)
    - Scheduler job (scheduler/jobs.py)
    - CLI script
"""

import logging
from typing import Dict, Any, List

from sqlalchemy.orm import Session

from app.search.soil_loader import load_soil_data
from app.ingestion.loaders import parse_soil_json
from app.pipeline.data_cleaning import clean_soil_batch
from app.pipeline.data_validation import validate_soil_batch
from app.ingestion.repository import (
    create_batch,
    mark_batch_completed,
    log_error,
    get_or_create_location,
    insert_soil_record,
)

logger = logging.getLogger(__name__)


def run_soil_ingestion(
    db: Session,
    filename: str = "egypt_soil_data.json",
    source_system: str = "JSON_File_Pipeline",
) -> Dict[str, Any]:
    """
    Execute the full soil data ingestion pipeline.

    Steps:
        1. Load data from source via soil_loader connector
        2. Parse into structured records
        3. Clean (normalise governorate names, soil type labels, numeric types)
        4. Validate (moisture 0–1, ph 0–14, required fields)
        5. Store valid records into DB
        6. Log errors for invalid records
        7. Track batch status

    Args:
        db: SQLAlchemy database session.
        filename: JSON filename inside data/csv/.
        source_system: Label stored in batch metadata.

    Returns:
        Dict with pipeline execution results:
            batch_id, inserted_count, error_count, skipped_duplicates, status
    """
    logger.info(f"[Soil Pipeline] Starting ingestion from '{filename}'")

    # Step 1: Create batch record
    batch = create_batch(db, source_system=source_system)
    batch_id = batch.batch_id
    logger.info(f"[Soil Pipeline] Created batch #{batch_id}")

    try:
        # Step 2: Load raw data from connector
        raw_data: List[Dict] = load_soil_data(filename)
        logger.info(f"[Soil Pipeline] Loaded {len(raw_data)} raw records")

        # Step 3: Parse (per-record error capture)
        parsed_records, invalid_parsed = parse_soil_json(raw_data)
        for inv in invalid_parsed:
            log_error(db, batch_id, "SOIL_PARSE", inv["error"], inv.get("record", ""))
        logger.info(f"[Soil Pipeline] Parsed {len(parsed_records)} records")

        # Step 4: Clean
        cleaned_records = clean_soil_batch(parsed_records)
        logger.info(f"[Soil Pipeline] Cleaned {len(cleaned_records)} records")

        # Step 5: Validate
        valid_records, invalid_records = validate_soil_batch(cleaned_records)
        logger.info(
            f"[Soil Pipeline] Validation: "
            f"{len(valid_records)} valid, {len(invalid_records)} invalid"
        )

        # Step 6a: Log validation errors
        error_count = len(invalid_parsed)
        for inv in invalid_records:
            for err_msg in inv["errors"]:
                log_error(db, batch_id, "VALIDATION", err_msg, str(inv["record"]))
                error_count += 1

        # Step 6b: Store valid records
        inserted_count = 0
        skipped_duplicates = 0

        for record in valid_records:
            governorate = record.get("governorate", "Unknown")
            location = get_or_create_location(db, governorate)
            try:
                insert_soil_record(db, record, batch_id, location.location_id)
                inserted_count += 1
            except Exception as e:
                err_str = str(e)
                if "UNIQUE" in err_str.upper() or "duplicate" in err_str.lower():
                    skipped_duplicates += 1
                    logger.debug(
                        f"[Soil Pipeline] Skipped duplicate: "
                        f"{governorate} / {record.get('soil_type')}"
                    )
                else:
                    error_count += 1
                    logger.warning(f"[Soil Pipeline] Insert error: {err_str}")

        # Step 7: Determine final batch status
        if error_count == 0 and inserted_count > 0:
            status = "COMPLETED"
        elif inserted_count > 0 and error_count > 0:
            status = "PARTIAL_SUCCESS"
        elif inserted_count == 0 and skipped_duplicates > 0 and error_count == 0:
            status = "COMPLETED_NO_NEW_DATA"
        else:
            status = "FAILED"

        mark_batch_completed(db, batch_id, status)

        result = {
            "batch_id": batch_id,
            "source_file": filename,
            "total_raw": len(raw_data),
            "total_parsed": len(parsed_records),
            "total_valid": len(valid_records),
            "total_invalid": len(invalid_records) + len(invalid_parsed),
            "inserted_count": inserted_count,
            "skipped_duplicates": skipped_duplicates,
            "error_count": error_count,
            "status": status,
        }

        logger.info(f"[Soil Pipeline] Finished: {result}")
        return result

    except FileNotFoundError as e:
        log_error(db, batch_id, "SOURCE_LOAD", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Soil Pipeline] File not found: {e}")
        raise

    except ValueError as e:
        log_error(db, batch_id, "DATA_VALIDATION", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Soil Pipeline] Schema error: {e}")
        raise

    except Exception as e:
        log_error(db, batch_id, "UNKNOWN_ERROR", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Soil Pipeline] Unexpected error: {e}")
        raise
