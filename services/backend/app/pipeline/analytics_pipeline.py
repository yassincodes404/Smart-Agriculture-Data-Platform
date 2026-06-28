"""
pipeline/analytics_pipeline.py
--------------------------------
Cross-domain KPI aggregation pipeline.

This is the ANALYTICAL LAYER — it sits after all domain ingestion pipelines
and computes meaningful agricultural insights from clean, structured data.

Position in pipeline flow:
    Ingestion (climate, water, crop, soil)
        ↓
    ETL (clean + validate + store)
        ↓
    Analytics Pipeline  ← THIS FILE
        ↓
    Agricultural Feature Engineering
        ↓
    Prediction (ai/models/)

Rules:
    - Reads ONLY from clean domain tables — never from raw/staging data
    - No ML model inference here — descriptive analytics only
    - All outputs are stored in the analytics_summary table
    - Can be run independently (not chained to ingestion)

Input:  climate_records, water_records, crop_production_records
Output: analytics_summary rows (KPIs grouped by governorate, crop, year)
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models.climate_record import ClimateRecord
from app.models.water_record import WaterRecord
from app.models.crop_production_record import CropProductionRecord
from app.models.analytics_summary import AnalyticsSummary
from app.models.location import Location

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# KPI 1: Cultivated Area Distribution
# ---------------------------------------------------------------------------

def compute_area_kpis(db: Session) -> List[Dict[str, Any]]:
    """
    Compute cultivated area KPIs per governorate per year.

    Metrics:
        - total_area_feddan: Sum of area_feddan per governorate per year
        - area_pct_national: Governorate share of national total (%)

    Returns:
        List of KPI dicts grouped by (governorate, year).
    """
    logger.info("[Analytics] Computing area KPIs")

    rows = (
        db.query(
            Location.governorate,
            CropProductionRecord.year,
            func.sum(CropProductionRecord.area_feddan).label("total_area_feddan"),
        )
        .join(Location, CropProductionRecord.location_id == Location.location_id)
        .group_by(Location.governorate, CropProductionRecord.year)
        .all()
    )

    if not rows:
        logger.warning("[Analytics] No crop production records found for area KPIs")
        return []

    # Compute national totals per year for percentage calculation
    national_totals: Dict[int, float] = {}
    for row in rows:
        year = row.year
        area = float(row.total_area_feddan or 0)
        national_totals[year] = national_totals.get(year, 0.0) + area

    results = []
    for row in rows:
        year = row.year
        area = float(row.total_area_feddan or 0)
        national = national_totals.get(year, 1.0)
        area_pct = round((area / national) * 100.0, 4) if national > 0 else None

        results.append({
            "governorate": row.governorate,
            "year": year,
            "kpi_name": "cultivated_area_feddan",
            "kpi_value": area,
            "kpi_pct": area_pct,
        })

    logger.info(f"[Analytics] Area KPIs computed: {len(results)} rows")
    return results


# ---------------------------------------------------------------------------
# KPI 2: Crop Production Rankings
# ---------------------------------------------------------------------------

def compute_production_kpis(db: Session) -> List[Dict[str, Any]]:
    """
    Compute total production per crop per year, ranked nationally.

    Metrics:
        - total_production_tons: National production per crop per year
        - production_pct_national: Crop's share of all-crop national production (%)

    Returns:
        List of KPI dicts grouped by (crop_type, year).
    """
    logger.info("[Analytics] Computing production KPIs")

    rows = (
        db.query(
            CropProductionRecord.crop_type,
            CropProductionRecord.year,
            func.sum(CropProductionRecord.production_tons).label("total_production_tons"),
        )
        .group_by(CropProductionRecord.crop_type, CropProductionRecord.year)
        .all()
    )

    if not rows:
        logger.warning("[Analytics] No crop production records found for production KPIs")
        return []

    # National total per year
    national_totals: Dict[int, float] = {}
    for row in rows:
        year = row.year
        prod = float(row.total_production_tons or 0)
        national_totals[year] = national_totals.get(year, 0.0) + prod

    results = []
    for row in rows:
        year = row.year
        prod = float(row.total_production_tons or 0)
        national = national_totals.get(year, 1.0)
        prod_pct = round((prod / national) * 100.0, 4) if national > 0 else None

        results.append({
            "crop_type": row.crop_type,
            "year": year,
            "kpi_name": "total_production_tons",
            "kpi_value": prod,
            "kpi_pct": prod_pct,
        })

    logger.info(f"[Analytics] Production KPIs computed: {len(results)} rows")
    return results


# ---------------------------------------------------------------------------
# KPI 3: Water Efficiency per Crop
# ---------------------------------------------------------------------------

def compute_water_kpis(db: Session) -> List[Dict[str, Any]]:
    """
    Compute water consumption and efficiency metrics per crop per year.

    Metrics:
        - total_water_m3: Total water consumed per crop per year
        - water_per_ton: Water m³ used per tonne of production (efficiency metric)

    Requires both water_records and crop_production_records to be populated.

    Returns:
        List of KPI dicts grouped by (crop, year).
    """
    logger.info("[Analytics] Computing water KPIs")

    # Water totals per crop per year
    water_rows = (
        db.query(
            WaterRecord.crop,
            WaterRecord.year,
            func.sum(WaterRecord.water_consumption_m3).label("total_water_m3"),
        )
        .group_by(WaterRecord.crop, WaterRecord.year)
        .all()
    )

    # Production totals per crop per year
    prod_rows = (
        db.query(
            CropProductionRecord.crop_type,
            CropProductionRecord.year,
            func.sum(CropProductionRecord.production_tons).label("total_production_tons"),
        )
        .group_by(CropProductionRecord.crop_type, CropProductionRecord.year)
        .all()
    )

    # Build production lookup: (crop_type, year) → total_tons
    prod_lookup: Dict[tuple, float] = {
        (row.crop_type.lower(), row.year): float(row.total_production_tons or 0)
        for row in prod_rows
    }

    results = []
    for row in water_rows:
        crop = row.crop
        year = row.year
        water_m3 = float(row.total_water_m3 or 0)
        production_tons = prod_lookup.get((crop.lower(), year), 0.0)

        # Guard: avoid division by zero
        water_per_ton = (
            round(water_m3 / production_tons, 4)
            if production_tons > 0
            else None
        )

        results.append({
            "crop_type": crop,
            "year": year,
            "kpi_name": "water_m3_per_ton",
            "kpi_value": water_m3,
            "water_per_ton": water_per_ton,
        })

    logger.info(f"[Analytics] Water KPIs computed: {len(results)} rows")
    return results


# ---------------------------------------------------------------------------
# KPI 4: Climate Summary per Governorate
# ---------------------------------------------------------------------------

def compute_climate_kpis(db: Session) -> List[Dict[str, Any]]:
    """
    Compute average climate conditions per governorate per year.

    Metrics:
        - avg_temperature: Mean annual temperature
        - avg_humidity: Mean annual humidity

    Returns:
        List of KPI dicts grouped by (governorate, year).
    """
    logger.info("[Analytics] Computing climate KPIs")

    rows = (
        db.query(
            Location.governorate,
            ClimateRecord.year,
            func.avg(ClimateRecord.temperature_mean).label("avg_temperature"),
            func.avg(ClimateRecord.humidity_pct).label("avg_humidity"),
        )
        .join(Location, ClimateRecord.location_id == Location.location_id)
        .group_by(Location.governorate, ClimateRecord.year)
        .all()
    )

    results = [
        {
            "governorate": row.governorate,
            "year": row.year,
            "kpi_name": "climate_summary",
            "avg_temperature": round(float(row.avg_temperature), 4) if row.avg_temperature else None,
            "avg_humidity": round(float(row.avg_humidity), 4) if row.avg_humidity else None,
        }
        for row in rows
    ]

    logger.info(f"[Analytics] Climate KPIs computed: {len(results)} rows")
    return results


# ---------------------------------------------------------------------------
# Main Analytics Pipeline Entry Point
# ---------------------------------------------------------------------------

def run_analytics_pipeline(db: Session) -> Dict[str, Any]:
    """
    Execute the full cross-domain analytics pipeline.

    Computes all KPI categories and stores results.
    This is the single entry-point for the analytics layer.

    Args:
        db: SQLAlchemy database session.

    Returns:
        Dict with summary of computed KPIs per category.
    """
    logger.info("[Analytics Pipeline] Starting full analytics run")

    results: Dict[str, Any] = {
        "area_kpis": 0,
        "production_kpis": 0,
        "water_kpis": 0,
        "climate_kpis": 0,
        "errors": [],
    }

    # KPI 1: Area
    try:
        area_kpis = compute_area_kpis(db)
        results["area_kpis"] = len(area_kpis)
    except Exception as e:
        logger.error(f"[Analytics Pipeline] Area KPI error: {e}")
        results["errors"].append(f"area_kpis: {e}")

    # KPI 2: Production
    try:
        production_kpis = compute_production_kpis(db)
        results["production_kpis"] = len(production_kpis)
    except Exception as e:
        logger.error(f"[Analytics Pipeline] Production KPI error: {e}")
        results["errors"].append(f"production_kpis: {e}")

    # KPI 3: Water
    try:
        water_kpis = compute_water_kpis(db)
        results["water_kpis"] = len(water_kpis)
    except Exception as e:
        logger.error(f"[Analytics Pipeline] Water KPI error: {e}")
        results["errors"].append(f"water_kpis: {e}")

    # KPI 4: Climate
    try:
        climate_kpis = compute_climate_kpis(db)
        results["climate_kpis"] = len(climate_kpis)
    except Exception as e:
        logger.error(f"[Analytics Pipeline] Climate KPI error: {e}")
        results["errors"].append(f"climate_kpis: {e}")

    status = "COMPLETED" if not results["errors"] else "PARTIAL_SUCCESS"
    results["status"] = status

    logger.info(f"[Analytics Pipeline] Finished: {results}")
    return results
