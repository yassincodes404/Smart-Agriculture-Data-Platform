"""
pipeline/crop_pipeline.py
--------------------------
Central orchestration pipeline for crop production data ingestion.

End-to-end flow (from 2026-04-18_Data_Pipeline_Guide.md):
    1. Source Connector  (search/crop_loader)        → load raw CSV
    2. Parse             (ingestion/loaders)          → CSV text → dicts
    3. Clean             (pipeline/data_cleaning)     → normalise names/types
    4. Validate          (pipeline/data_validation)   → range checks, schema
    5. Store             (ingestion/repository)       → insert to DB
    6. Track             (ingestion_batches)          → batch status + errors

Single entry-point: run_crop_ingestion()
Can be called from:
    - API endpoint  (POST /api/v1/pipeline/crop/run)
    - Scheduler job (scheduler/jobs.py)
    - CLI script
"""

import logging
from typing import Dict, Any

from sqlalchemy.orm import Session

from app.search.crop_loader import load_crop_csv, load_crop_records
from app.ingestion.loaders import parse_crop_csv
from app.pipeline.data_cleaning import clean_crop_batch
from app.pipeline.data_validation import validate_crop_batch
from app.ingestion.repository import (
    create_batch,
    mark_batch_completed,
    log_error,
    get_or_create_location,
    insert_crop_record,
)

logger = logging.getLogger(__name__)


def run_crop_ingestion(
    db: Session,
    filename: str = "egypt_crop_production.csv",
    source_system: str = "CSV_File_Pipeline",
) -> Dict[str, Any]:
    """
    Execute the full crop production data ingestion pipeline.

    Steps:
        1. Load CSV from data/csv/ via the crop_loader connector
        2. Parse into structured records
        3. Clean (normalise governorate names, crop types, unit types)
        4. Validate (range checks, schema)
        5. Store valid records into DB
        6. Log errors for invalid records
        7. Track batch status

    Args:
        db: SQLAlchemy database session.
        filename: CSV filename inside data/csv/.
        source_system: Label stored in batch metadata.

    Returns:
        Dict with pipeline execution results:
            batch_id, inserted_count, error_count, skipped_duplicates, status
    """
    logger.info(f"[Crop Pipeline] Starting ingestion from '{filename}'")

    # Step 1: Create batch record
    batch = create_batch(db, source_system=source_system)
    batch_id = batch.batch_id
    logger.info(f"[Crop Pipeline] Created batch #{batch_id}")

    try:
        # Step 2: Load and parse via source connector
        # load_crop_records() is the single parse entry-point (no dual-load)
        parsed_records = load_crop_records(filename)
        logger.info(f"[Crop Pipeline] Parsed {len(parsed_records)} records")

        # Step 3: Clean
        cleaned_records = clean_crop_batch(parsed_records)
        logger.info(f"[Crop Pipeline] Cleaned {len(cleaned_records)} records")

        # Step 4: Validate
        valid_records, invalid_records = validate_crop_batch(cleaned_records)
        logger.info(
            f"[Crop Pipeline] Validation: "
            f"{len(valid_records)} valid, {len(invalid_records)} invalid"
        )

        # Step 5a: Log validation errors
        error_count = 0
        for inv in invalid_records:
            for err_msg in inv["errors"]:
                log_error(db, batch_id, "VALIDATION", err_msg, str(inv["record"]))
                error_count += 1

        # Step 5b: Store valid records
        inserted_count = 0
        skipped_duplicates = 0

        for record in valid_records:
            location = get_or_create_location(db, record["governorate"])
            try:
                insert_crop_record(db, record, batch_id, location.location_id)
                inserted_count += 1
            except Exception as e:
                err_str = str(e)
                if "UNIQUE" in err_str.upper() or "duplicate" in err_str.lower():
                    skipped_duplicates += 1
                    logger.debug(
                        f"[Crop Pipeline] Skipped duplicate: "
                        f"{record['governorate']} / {record['crop_type']} / {record['year']}"
                    )
                else:
                    error_count += 1
                    logger.warning(f"[Crop Pipeline] Insert error: {err_str}")

        # Step 6: Determine final batch status
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
            "total_parsed": len(parsed_records),
            "total_cleaned": len(cleaned_records),
            "total_valid": len(valid_records),
            "total_invalid": len(invalid_records),
            "inserted_count": inserted_count,
            "skipped_duplicates": skipped_duplicates,
            "error_count": error_count,
            "status": status,
        }

        logger.info(f"[Crop Pipeline] Finished: {result}")
        return result

    except FileNotFoundError as e:
        log_error(db, batch_id, "SOURCE_LOAD", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Crop Pipeline] File not found: {e}")
        raise

    except ValueError as e:
        log_error(db, batch_id, "CSV_VALIDATION", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Crop Pipeline] Schema error: {e}")
        raise

    except Exception as e:
        log_error(db, batch_id, "UNKNOWN_ERROR", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Crop Pipeline] Unexpected error: {e}")
        raise


def run_crop_ingestion_from_content(
    db: Session,
    csv_content: str,
    source_system: str = "CSV_Content_Pipeline",
) -> Dict[str, Any]:
    """
    Execute the crop pipeline from raw CSV string content
    (e.g., from a direct API upload).

    Uses parse_crop_csv() from ingestion/loaders.py for per-row
    error capture instead of the bulk loader.

    Args:
        db: SQLAlchemy database session.
        csv_content: Raw CSV string.
        source_system: Label stored in batch metadata.

    Returns:
        Pipeline execution results dict.
    """
    logger.info(
        f"[Crop Pipeline] Starting ingestion from raw content "
        f"({len(csv_content)} bytes)"
    )

    batch = create_batch(db, source_system=source_system)
    batch_id = batch.batch_id

    try:
        # Parse with per-row error capture
        valid_parsed, invalid_parsed = parse_crop_csv(csv_content)

        cleaned_records = clean_crop_batch(valid_parsed)
        valid_records, invalid_records = validate_crop_batch(cleaned_records)

        error_count = 0
        for inv in invalid_parsed:
            log_error(db, batch_id, "CSV_PARSE", inv["error"], inv["record"])
            error_count += 1

        for inv in invalid_records:
            for err_msg in inv["errors"]:
                log_error(db, batch_id, "VALIDATION", err_msg, str(inv["record"]))
                error_count += 1

        inserted_count = 0
        skipped_duplicates = 0

        for record in valid_records:
            location = get_or_create_location(db, record["governorate"])
            try:
                insert_crop_record(db, record, batch_id, location.location_id)
                inserted_count += 1
            except Exception as e:
                err_str = str(e)
                if "UNIQUE" in err_str.upper() or "duplicate" in err_str.lower():
                    skipped_duplicates += 1
                else:
                    error_count += 1

        if error_count == 0 and inserted_count > 0:
            status = "COMPLETED"
        elif inserted_count > 0 and error_count > 0:
            status = "PARTIAL_SUCCESS"
        elif inserted_count == 0 and skipped_duplicates > 0 and error_count == 0:
            status = "COMPLETED_NO_NEW_DATA"
        else:
            status = "FAILED"

        mark_batch_completed(db, batch_id, status)

        return {
            "batch_id": batch_id,
            "total_parsed": len(valid_parsed) + len(invalid_parsed),
            "inserted_count": inserted_count,
            "skipped_duplicates": skipped_duplicates,
            "error_count": error_count,
            "status": status,
        }

    except ValueError as e:
        log_error(db, batch_id, "CSV_VALIDATION", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        raise

    except Exception as e:
        log_error(db, batch_id, "UNKNOWN_ERROR", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        raise
