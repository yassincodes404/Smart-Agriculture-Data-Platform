"""
pipeline/land_analytics_pipeline.py
------------------------------------
Central orchestration pipeline for the Land Analytics data pipeline.

End-to-end flow (from architecture docs):
    1. Load all data sources (climate JSON, satellite GeoTIFF, crop CSV,
       water CSV/JSON, soil JSON, CV/AI outputs)
    2. Parse each source into structured records
    3. Clean each domain's records (normalise names, types)
    4. Validate each domain (range checks, schema)
    5. Process / Feature Engineering (compute NDVI, water estimates, health)
    6. Merge into final per-land analytics records
    7. Validate merged records
    8. Store in DB
    9. Track batch status

This module is the single entry-point for running the land analytics pipeline.
It can be called from:
    - An API endpoint (POST /api/v1/pipeline/land/run)
    - A background task / scheduler
    - A CLI script

The pipeline accepts data as in-memory payloads (dicts/lists) so that
source connectors can feed it from files, APIs, or any other source.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.ingestion.loaders import (
    parse_climate_json,
    parse_soil_json,
)
from app.pipeline.data_cleaning import (
    clean_climate_api_batch,
    clean_crop_batch,
    clean_soil_batch,
)
from app.pipeline.data_validation import (
    validate_climate_api_batch,
    validate_crop_batch,
    validate_soil_batch,
    validate_land_analytics_batch,
)
from app.pipeline.feature_engineering import (
    calculate_ndvi_from_geotiff,
    compute_health_index,
    compute_risk_level,
    estimate_water_usage,
)
from app.ingestion.repository import (
    create_batch,
    mark_batch_completed,
    log_error,
    get_or_create_location,
    insert_land_analytics_record,
)

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Pipeline Entrypoints
# ---------------------------------------------------------------------------

def run_land_analytics_pipeline(
    db: Session,
    land_records: List[Dict[str, Any]],
    climate_data: Optional[List[Dict[str, Any]]] = None,
    satellite_bands: Optional[Dict[str, Any]] = None,
    crop_data: Optional[List[Dict[str, Any]]] = None,
    soil_data: Optional[List[Dict[str, Any]]] = None,
    water_data: Optional[List[Dict[str, Any]]] = None,
    cv_ai_outputs: Optional[List[Dict[str, Any]]] = None,
    source_system: str = "LandAnalytics_Pipeline",
) -> Dict[str, Any]:
    """
    Execute the full land analytics pipeline.

    Steps:
        1. Create batch record
        2. Parse each source
        3. Clean each domain
        4. Validate each domain
        5. Process (NDVI, water estimates, health index, risk)
        6. Merge into final per-land records
        7. Validate merged records
        8. Store valid records into DB
        9. Log errors for invalid records
        10. Track batch status

    Args:
        db: SQLAlchemy database session.
        land_records: Base land/parcel records, each with at minimum:
            {land_id, governorate, latitude, longitude}
        climate_data: Climate JSON API records (optional).
        satellite_bands: GeoTIFF bands dict with 'red' and 'nir' keys (optional).
        crop_data: Crop production records (optional).
        soil_data: Soil JSON records (optional).
        water_data: Water CSV/JSON records (optional).
        cv_ai_outputs: Pre-processed CV/AI outputs (optional).
        source_system: Label for the source.

    Returns:
        Dict with pipeline execution results:
            batch_id, inserted_count, error_count, status
    """
    logger.info("[Land Analytics Pipeline] Starting pipeline run")

    # --- Step 1: Create batch record ---
    batch = create_batch(db, source_system=source_system)
    batch_id = batch.batch_id
    logger.info(f"[Land Analytics Pipeline] Created batch #{batch_id}")

    try:
        error_count = 0

        # --- Step 2 & 3 & 4: Parse → Clean → Validate each source ---

        # Climate data
        valid_climate: List[Dict[str, Any]] = []
        if climate_data:
            parsed_climate, invalid_climate_parse = parse_climate_json(climate_data)
            for inv in invalid_climate_parse:
                log_error(db, batch_id, "CLIMATE_PARSE", inv["error"], inv.get("record", ""))
                error_count += 1

            cleaned_climate = clean_climate_api_batch(parsed_climate)
            valid_climate, invalid_climate = validate_climate_api_batch(cleaned_climate)
            for inv in invalid_climate:
                for err_msg in inv["errors"]:
                    log_error(db, batch_id, "CLIMATE_VALIDATION", err_msg, str(inv["record"]))
                    error_count += 1
            logger.info(
                f"[Land Analytics Pipeline] Climate: {len(valid_climate)} valid, "
                f"{len(invalid_climate_parse) + len(invalid_climate)} invalid"
            )

        # Soil data
        valid_soil: List[Dict[str, Any]] = []
        if soil_data:
            parsed_soil, invalid_soil_parse = parse_soil_json(soil_data)
            for inv in invalid_soil_parse:
                log_error(db, batch_id, "SOIL_PARSE", inv["error"], inv.get("record", ""))
                error_count += 1

            cleaned_soil = clean_soil_batch(parsed_soil)
            valid_soil, invalid_soil = validate_soil_batch(cleaned_soil)
            for inv in invalid_soil:
                for err_msg in inv["errors"]:
                    log_error(db, batch_id, "SOIL_VALIDATION", err_msg, str(inv["record"]))
                    error_count += 1
            logger.info(
                f"[Land Analytics Pipeline] Soil: {len(valid_soil)} valid"
            )

        # Crop data
        valid_crop: List[Dict[str, Any]] = []
        if crop_data:
            cleaned_crop = clean_crop_batch(crop_data)
            valid_crop, invalid_crop = validate_crop_batch(cleaned_crop)
            for inv in invalid_crop:
                for err_msg in inv["errors"]:
                    log_error(db, batch_id, "CROP_VALIDATION", err_msg, str(inv["record"]))
                    error_count += 1
            logger.info(
                f"[Land Analytics Pipeline] Crop: {len(valid_crop)} valid"
            )

        # Water data (passed through as-is; already structured)
        valid_water: List[Dict[str, Any]] = water_data or []

        # CV/AI outputs (passed through as-is; already processed)
        ai_outputs: List[Dict[str, Any]] = cv_ai_outputs or []

        # --- Step 5: Feature Engineering ---

        # Compute NDVI from satellite bands
        ndvi_value: Optional[float] = None
        if satellite_bands:
            try:
                ndvi_value = calculate_ndvi_from_geotiff(satellite_bands)
                logger.info(f"[Land Analytics Pipeline] Computed NDVI: {ndvi_value}")
            except Exception as e:
                log_error(db, batch_id, "NDVI_COMPUTATION", str(e))
                error_count += 1
                logger.warning(f"[Land Analytics Pipeline] NDVI computation failed: {e}")

        # --- Step 6: Merge into final per-land records ---
        merged_records = _merge_land_records(
            land_records=land_records,
            climate_records=valid_climate,
            soil_records=valid_soil,
            crop_records=valid_crop,
            water_records=valid_water,
            ai_outputs=ai_outputs,
            ndvi_value=ndvi_value,
        )
        logger.info(
            f"[Land Analytics Pipeline] Merged {len(merged_records)} land records"
        )

        # --- Step 7: Validate merged records ---
        valid_records, invalid_records = validate_land_analytics_batch(merged_records)
        for inv in invalid_records:
            for err_msg in inv["errors"]:
                log_error(db, batch_id, "MERGE_VALIDATION", err_msg, str(inv["record"]))
                error_count += 1

        # --- Step 8: Store valid records ---
        inserted_count = 0
        skipped_duplicates = 0

        for record in valid_records:
            governorate = record.get("governorate", "Unknown")
            location = get_or_create_location(db, governorate)

            try:
                insert_land_analytics_record(db, record, batch_id, location.location_id)
                inserted_count += 1
            except Exception as e:
                err_str = str(e)
                if "UNIQUE" in err_str.upper() or "duplicate" in err_str.lower():
                    skipped_duplicates += 1
                    logger.debug(
                        f"[Land Analytics Pipeline] Skipped duplicate: "
                        f"land_id={record.get('land_id')}"
                    )
                else:
                    error_count += 1
                    logger.warning(
                        f"[Land Analytics Pipeline] Insert error: {err_str}"
                    )

        # --- Step 9: Determine final status ---
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
            "total_land_records": len(land_records),
            "total_merged": len(merged_records),
            "total_valid": len(valid_records),
            "total_invalid": len(invalid_records),
            "inserted_count": inserted_count,
            "skipped_duplicates": skipped_duplicates,
            "error_count": error_count,
            "status": status,
        }

        logger.info(f"[Land Analytics Pipeline] Finished: {result}")
        return result

    except Exception as e:
        log_error(db, batch_id, "UNKNOWN_ERROR", str(e))
        mark_batch_completed(db, batch_id, "FAILED")
        logger.error(f"[Land Analytics Pipeline] Unexpected error: {e}")
        raise


# ---------------------------------------------------------------------------
# Internal: Merge records from all domains into per-land output
# ---------------------------------------------------------------------------

def _merge_land_records(
    land_records: List[Dict[str, Any]],
    climate_records: List[Dict[str, Any]],
    soil_records: List[Dict[str, Any]],
    crop_records: List[Dict[str, Any]],
    water_records: List[Dict[str, Any]],
    ai_outputs: List[Dict[str, Any]],
    ndvi_value: Optional[float],
) -> List[Dict[str, Any]]:
    """
    Merge data from all domains into unified per-land analytics records.

    Matching strategy:
        - Primary: by land_id
        - Fallback: by governorate name

    Args:
        land_records: Base land records with land_id and governorate.
        climate_records: Cleaned and validated climate data.
        soil_records: Cleaned and validated soil data.
        crop_records: Cleaned and validated crop data.
        water_records: Water data.
        ai_outputs: Pre-processed CV/AI outputs.
        ndvi_value: Global NDVI computed from satellite imagery.

    Returns:
        List of merged land analytics dicts ready for validation and storage.
    """
    # Build lookup indices for fast matching
    climate_by_land = _index_by_key(climate_records, "land_id")
    climate_by_gov = _index_by_key(climate_records, "governorate")
    soil_by_land = _index_by_key(soil_records, "land_id")
    soil_by_gov = _index_by_key(soil_records, "governorate")
    crop_by_land = _index_by_key(crop_records, "land_id")
    crop_by_gov = _index_by_key(crop_records, "governorate")
    water_by_land = _index_by_key(water_records, "land_id")
    ai_by_land = _index_by_key(ai_outputs, "land_id")

    merged: List[Dict[str, Any]] = []

    for land in land_records:
        land_id = land.get("land_id")
        gov = land.get("governorate", "Unknown")

        record: Dict[str, Any] = {
            "land_id": land_id,
            "governorate": gov,
        }

        # --- Merge climate ---
        clim = (
            climate_by_land.get(land_id)
            or climate_by_gov.get(gov)
        )
        if clim:
            record["temperature"] = clim.get("temperature")
            record["rainfall"] = clim.get("rainfall")
        else:
            record["temperature"] = land.get("temperature")
            record["rainfall"] = land.get("rainfall")

        # --- Merge soil ---
        soil = (
            soil_by_land.get(land_id)
            or soil_by_gov.get(gov)
        )
        if soil:
            record["soil_moisture"] = soil.get("soil_moisture")
        else:
            record["soil_moisture"] = land.get("soil_moisture")

        # --- Merge crop ---
        crop = (
            crop_by_land.get(land_id)
            or crop_by_gov.get(gov)
        )
        if crop:
            record["crop_type"] = crop.get("crop_type")
            record.setdefault("area_feddan", crop.get("area_feddan", 1.0))
        else:
            record["crop_type"] = land.get("crop_type")

        # --- Merge water ---
        water = water_by_land.get(land_id)
        # water_need_estimate will be computed below if not provided

        # --- Merge AI/CV outputs ---
        ai = ai_by_land.get(land_id)
        if ai:
            # AI outputs can override any field
            for key in ("ndvi", "vegetation_health", "crop_type", "risk_level"):
                if key in ai:
                    record[key] = ai[key]

        # --- NDVI ---
        if "ndvi" not in record or record.get("ndvi") is None:
            if ndvi_value is not None:
                record["ndvi"] = ndvi_value
            else:
                record["ndvi"] = land.get("ndvi", 0.5)

        # --- Compute vegetation health ---
        if "vegetation_health" not in record or record.get("vegetation_health") is None:
            record["vegetation_health"] = compute_health_index(
                record.get("ndvi", 0.5)
            )

        # --- Compute water need estimate ---
        if water and "water_need_estimate" in water:
            record["water_need_estimate"] = water["water_need_estimate"]
        elif "water_need_estimate" not in record or record.get("water_need_estimate") is None:
            record["water_need_estimate"] = estimate_water_usage(
                crop_type=record.get("crop_type") or "wheat",
                area_feddan=record.get("area_feddan") or 1.0,
                soil_moisture=record.get("soil_moisture") if record.get("soil_moisture") is not None else 0.5,
                temperature=record.get("temperature") if record.get("temperature") is not None else 25.0,
                rainfall=record.get("rainfall") if record.get("rainfall") is not None else 0.0,
            )

        # --- Compute risk level ---
        if "risk_level" not in record or record.get("risk_level") is None:
            record["risk_level"] = compute_risk_level(
                ndvi=record.get("ndvi") if record.get("ndvi") is not None else 0.5,
                soil_moisture=record.get("soil_moisture") if record.get("soil_moisture") is not None else 0.5,
                temperature=record.get("temperature") if record.get("temperature") is not None else 25.0,
                rainfall=record.get("rainfall") if record.get("rainfall") is not None else 5.0,
            )

        # Remove internal-only fields before storage
        record.pop("area_feddan", None)

        merged.append(record)

    return merged


def _index_by_key(
    records: List[Dict[str, Any]],
    key: str,
) -> Dict[Any, Dict[str, Any]]:
    """
    Build a lookup index from a list of dicts.

    Returns a dict mapping key-value → first matching record.
    Records missing the key are skipped.
    """
    index: Dict[Any, Dict[str, Any]] = {}
    for rec in records:
        val = rec.get(key)
        if val is not None and val not in index:
            index[val] = rec
    return index
