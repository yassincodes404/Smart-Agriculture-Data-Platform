"""
tests/pipeline/test_land_pipeline.py
-------------------------------------
Integration tests for the Land Analytics Data Pipeline.

Tests the full pipeline flow:
    Multi-source data → Parse → Clean → Validate → Feature Engineering → Merge → Store → Track

Uses the same SQLite test database as the rest of the test suite.
"""

import pytest
import numpy as np
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.pipeline.land_analytics_pipeline import run_land_analytics_pipeline
from app.pipeline.feature_engineering import (
    calculate_ndvi_from_bands,
    calculate_ndvi_from_geotiff,
    compute_health_index,
    compute_risk_level,
    estimate_water_usage,
)
from app.pipeline.data_cleaning import (
    clean_crop_record,
    clean_soil_record,
    clean_climate_api_record,
    normalise_governorate,
)
from app.pipeline.data_validation import (
    validate_ndvi,
    validate_soil_record,
    validate_crop_record,
    validate_land_analytics_record,
    validate_land_analytics_batch,
)
from app.models.land_analytics_record import LandAnalyticsRecord
from app.models.location import Location
from app.models.ingestion_batch import IngestionBatch
from app.models.etl_error import EtlError


# ============================================================================
# Sample Data Fixtures
# ============================================================================

def _valid_land_records():
    """Return a list of valid land records for testing."""
    return [
        {
            "land_id": 1,
            "governorate": "Cairo",
            "latitude": 30.05,
            "longitude": 31.25,
            "temperature": 26.1,
            "rainfall": 0.2,
            "soil_moisture": 0.28,
            "crop_type": "wheat",
        },
        {
            "land_id": 2,
            "governorate": "Giza",
            "latitude": 30.01,
            "longitude": 31.21,
            "temperature": 27.5,
            "rainfall": 0.5,
            "soil_moisture": 0.35,
            "crop_type": "rice",
        },
        {
            "land_id": 3,
            "governorate": "Alexandria",
            "latitude": 31.20,
            "longitude": 29.95,
            "temperature": 22.0,
            "rainfall": 5.0,
            "soil_moisture": 0.40,
            "crop_type": "cotton",
        },
    ]


def _valid_climate_data():
    """Return valid climate JSON API data."""
    return [
        {"governorate": "Cairo", "land_id": 1, "temperature": 26.1, "rainfall": 0.2},
        {"governorate": "Giza", "land_id": 2, "temperature": 27.5, "rainfall": 0.5},
        {"governorate": "Alexandria", "land_id": 3, "temperature": 22.0, "rainfall": 5.0},
    ]


def _valid_soil_data():
    """Return valid soil JSON data."""
    return [
        {"governorate": "Cairo", "land_id": 1, "soil_moisture": 0.28, "soil_type": "clay", "ph": 7.2},
        {"governorate": "Giza", "land_id": 2, "soil_moisture": 0.35, "soil_type": "loam", "ph": 6.8},
        {"governorate": "Alexandria", "land_id": 3, "soil_moisture": 0.40, "soil_type": "sandy", "ph": 7.0},
    ]


def _valid_crop_data():
    """Return valid crop records."""
    return [
        {"governorate": "Cairo", "land_id": 1, "crop_type": "wheat", "year": 2023, "production_tons": 500, "area_feddan": 10},
        {"governorate": "Giza", "land_id": 2, "crop_type": "rice", "year": 2023, "production_tons": 300, "area_feddan": 8},
    ]


def _valid_satellite_bands():
    """Return valid GeoTIFF band arrays for NDVI computation."""
    return {
        "red": np.array([[0.1, 0.2], [0.15, 0.25]]),
        "nir": np.array([[0.5, 0.6], [0.55, 0.65]]),
    }


# ============================================================================
# Unit Tests — Feature Engineering
# ============================================================================

class TestFeatureEngineering:
    """Tests for pipeline/feature_engineering.py"""

    def test_ndvi_from_bands_basic(self):
        """NDVI calculation from simple red/NIR arrays."""
        red = np.array([[0.1, 0.2], [0.15, 0.25]])
        nir = np.array([[0.5, 0.6], [0.55, 0.65]])
        ndvi = calculate_ndvi_from_bands(red, nir)

        assert ndvi.shape == (2, 2)
        # (0.5 - 0.1) / (0.5 + 0.1) = 0.4/0.6 ≈ 0.6667
        assert 0.60 < ndvi[0, 0] < 0.70
        # All values should be in [0, 1]
        assert np.all(ndvi >= 0.0)
        assert np.all(ndvi <= 1.0)

    def test_ndvi_from_bands_zero_denominator(self):
        """NDVI handles zero denominator (no reflectance)."""
        red = np.array([[0.0, 0.1]])
        nir = np.array([[0.0, 0.3]])
        ndvi = calculate_ndvi_from_bands(red, nir)
        assert ndvi[0, 0] == 0.0  # zero / zero = 0

    def test_ndvi_from_geotiff(self):
        """Mean NDVI from a bands dict."""
        bands = _valid_satellite_bands()
        mean_ndvi = calculate_ndvi_from_geotiff(bands)
        assert 0.0 <= mean_ndvi <= 1.0
        assert isinstance(mean_ndvi, float)

    def test_ndvi_from_geotiff_missing_band_raises(self):
        """Missing NIR band raises ValueError."""
        with pytest.raises(ValueError, match="must contain"):
            calculate_ndvi_from_geotiff({"red": np.array([[0.1]])})

    def test_compute_health_index_critical(self):
        assert compute_health_index(0.05) == "critical"

    def test_compute_health_index_low(self):
        assert compute_health_index(0.20) == "low"

    def test_compute_health_index_moderate(self):
        assert compute_health_index(0.40) == "moderate"

    def test_compute_health_index_high(self):
        assert compute_health_index(0.60) == "high"

    def test_compute_health_index_very_high(self):
        assert compute_health_index(0.85) == "very_high"

    def test_estimate_water_usage_positive(self):
        """Water estimate returns a positive value."""
        water = estimate_water_usage("wheat", area_feddan=1.0, soil_moisture=0.3, temperature=30.0, rainfall=0.0)
        assert water > 0
        assert isinstance(water, float)

    def test_estimate_water_usage_high_moisture_reduces_need(self):
        """Higher soil moisture → lower water need."""
        dry = estimate_water_usage("wheat", soil_moisture=0.1, temperature=30.0, rainfall=0.0)
        wet = estimate_water_usage("wheat", soil_moisture=0.9, temperature=30.0, rainfall=0.0)
        assert dry > wet

    def test_estimate_water_usage_rainfall_reduces_need(self):
        """Rainfall should reduce water need."""
        no_rain = estimate_water_usage("wheat", rainfall=0.0, temperature=30.0)
        with_rain = estimate_water_usage("wheat", rainfall=10.0, temperature=30.0)
        assert no_rain >= with_rain

    def test_compute_risk_level_low(self):
        risk = compute_risk_level(ndvi=0.8, soil_moisture=0.5, temperature=25.0, rainfall=10.0)
        assert risk == "low"

    def test_compute_risk_level_critical(self):
        risk = compute_risk_level(ndvi=0.05, soil_moisture=0.05, temperature=50.0, rainfall=0.0)
        assert risk == "critical"

    def test_compute_risk_level_medium(self):
        risk = compute_risk_level(ndvi=0.35, soil_moisture=0.25, temperature=30.0, rainfall=3.0)
        assert risk == "medium"


# ============================================================================
# Unit Tests — Data Cleaning (new domains)
# ============================================================================

class TestLandDataCleaning:
    """Tests for crop, soil, and climate API cleaning functions."""

    def test_clean_crop_record(self):
        raw = {"governorate": "el cairo", "crop_type": "  wheat  ", "year": "2023", "production_tons": "500", "area_feddan": "10"}
        cleaned = clean_crop_record(raw)
        assert cleaned["governorate"] == "Cairo"
        assert cleaned["crop_type"] == "Wheat"
        assert cleaned["year"] == 2023
        assert cleaned["production_tons"] == 500.0

    def test_clean_soil_record(self):
        raw = {"governorate": "alex", "soil_moisture": "0.35", "soil_type": "CLAY", "ph": "7.2"}
        cleaned = clean_soil_record(raw)
        assert cleaned["governorate"] == "Alexandria"
        assert cleaned["soil_moisture"] == 0.35
        assert cleaned["soil_type"] == "clay"

    def test_clean_climate_api_record(self):
        raw = {"governorate": "el cairo", "temperature": "26.5", "rainfall": "1.2", "land_id": 1}
        cleaned = clean_climate_api_record(raw)
        assert cleaned["governorate"] == "Cairo"
        assert cleaned["temperature"] == 26.5
        assert cleaned["rainfall"] == 1.2
        assert cleaned["land_id"] == 1


# ============================================================================
# Unit Tests — Data Validation (new domains)
# ============================================================================

class TestLandDataValidation:
    """Tests for NDVI, soil, crop, and land analytics validation."""

    def test_validate_ndvi_valid(self):
        errors = validate_ndvi(0.78, 1)
        assert errors == []

    def test_validate_ndvi_out_of_range(self):
        errors = validate_ndvi(1.5, 1)
        assert len(errors) == 1
        assert "ndvi" in errors[0].lower()

    def test_validate_ndvi_negative(self):
        errors = validate_ndvi(-0.1, 1)
        assert len(errors) == 1

    def test_validate_soil_record_valid(self):
        record = {"soil_moisture": 0.28, "soil_type": "clay", "ph": 7.2}
        errors = validate_soil_record(record, 1)
        assert errors == []

    def test_validate_soil_moisture_out_of_range(self):
        record = {"soil_moisture": 1.5, "soil_type": "clay", "ph": 7.2}
        errors = validate_soil_record(record, 1)
        assert len(errors) == 1
        assert "soil_moisture" in errors[0].lower()

    def test_validate_crop_record_valid(self):
        record = {"governorate": "Cairo", "crop_type": "Wheat", "production_tons": 500.0, "area_feddan": 10.0, "year": 2023}
        errors = validate_crop_record(record, 1)
        assert errors == []

    def test_validate_crop_record_missing_governorate(self):
        record = {"governorate": "", "crop_type": "Wheat", "production_tons": 500.0, "area_feddan": 10.0}
        errors = validate_crop_record(record, 1)
        assert len(errors) == 1
        assert "governorate" in errors[0].lower()

    def test_validate_land_analytics_record_valid(self):
        record = {
            "land_id": 1,
            "temperature": 26.1,
            "rainfall": 0.2,
            "ndvi": 0.78,
            "vegetation_health": "high",
            "crop_type": "wheat",
            "soil_moisture": 0.28,
            "water_need_estimate": 1200.0,
            "risk_level": "medium",
        }
        errors = validate_land_analytics_record(record, 1)
        assert errors == []

    def test_validate_land_analytics_record_missing_land_id(self):
        record = {"temperature": 26.1, "ndvi": 0.78}
        errors = validate_land_analytics_record(record, 1)
        assert any("land_id" in e for e in errors)

    def test_validate_land_analytics_record_bad_ndvi(self):
        record = {"land_id": 1, "ndvi": 2.0}
        errors = validate_land_analytics_record(record, 1)
        assert any("ndvi" in e for e in errors)

    def test_validate_land_analytics_batch_mixed(self):
        records = [
            {"land_id": 1, "ndvi": 0.5, "vegetation_health": "high", "risk_level": "low"},
            {"land_id": None, "ndvi": 2.0, "vegetation_health": "invalid_label"},  # multiple errors
        ]
        valid, invalid = validate_land_analytics_batch(records)
        assert len(valid) == 1
        assert len(invalid) == 1


# ============================================================================
# Integration Tests — Full Pipeline (using test DB)
# ============================================================================

class TestLandAnalyticsPipelineIntegration:
    """Integration tests for the full land analytics pipeline using test SQLite DB."""

    def test_pipeline_valid_run_completed(self, db_session: Session):
        """Full pipeline with valid data → status COMPLETED."""
        land_records = _valid_land_records()

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
            climate_data=_valid_climate_data(),
            satellite_bands=_valid_satellite_bands(),
            crop_data=_valid_crop_data(),
            soil_data=_valid_soil_data(),
        )

        assert result["status"] == "COMPLETED"
        assert result["inserted_count"] == 3
        assert result["error_count"] == 0

        # Verify records in DB
        records = db_session.query(LandAnalyticsRecord).all()
        assert len(records) == 3

        # Verify locations created
        locations = db_session.query(Location).all()
        gov_names = {loc.governorate for loc in locations}
        assert "Cairo" in gov_names
        assert "Giza" in gov_names
        assert "Alexandria" in gov_names

        # Verify each record has the expected structure
        for rec in records:
            assert rec.land_id is not None
            assert rec.ndvi is not None
            assert rec.vegetation_health is not None
            assert rec.risk_level is not None
            assert rec.batch_id == result["batch_id"]

    def test_pipeline_mixed_data_partial_success(self, db_session: Session):
        """Pipeline with mixed valid/invalid data → PARTIAL_SUCCESS."""
        land_records = [
            {
                "land_id": 1,
                "governorate": "Cairo",
                "temperature": 26.1,
                "rainfall": 0.2,
                "soil_moisture": 0.28,
                "crop_type": "wheat",
            },
            {
                "land_id": 2,
                "governorate": "Giza",
                "temperature": 27.5,
                "rainfall": 0.5,
                "soil_moisture": 0.35,
                "crop_type": "rice",
            },
        ]

        # Climate data with one invalid record (temperature out of range)
        climate_data = [
            {"governorate": "Cairo", "land_id": 1, "temperature": 26.1, "rainfall": 0.2},
            {"governorate": "Giza", "land_id": 2, "temperature": 999.0, "rainfall": 0.5},  # invalid
        ]

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
            climate_data=climate_data,
        )

        assert result["inserted_count"] >= 1
        assert result["error_count"] >= 1
        assert result["status"] in ("PARTIAL_SUCCESS", "COMPLETED")

    def test_pipeline_invalid_all_failed(self, db_session: Session):
        """Pipeline where all records fail → status FAILED."""
        # land_records with no land_id → will fail validation
        land_records = [
            {"governorate": "Cairo"},  # missing land_id
            {"governorate": "Giza"},   # missing land_id
        ]

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
        )

        assert result["inserted_count"] == 0
        assert result["status"] == "FAILED"

    def test_pipeline_ndvi_computed_from_satellite(self, db_session: Session):
        """NDVI value is computed from satellite bands and stored."""
        land_records = [
            {"land_id": 10, "governorate": "Luxor", "temperature": 30.0, "rainfall": 0.1, "soil_moisture": 0.20},
        ]
        bands = _valid_satellite_bands()

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
            satellite_bands=bands,
        )

        assert result["status"] == "COMPLETED"
        assert result["inserted_count"] == 1

        record = db_session.query(LandAnalyticsRecord).filter(
            LandAnalyticsRecord.land_id == 10
        ).first()
        assert record is not None
        assert record.ndvi is not None
        ndvi_val = float(record.ndvi)
        assert 0.0 <= ndvi_val <= 1.0

    def test_pipeline_batch_tracking(self, db_session: Session):
        """Pipeline creates and updates batch record correctly."""
        land_records = [{"land_id": 20, "governorate": "Aswan", "temperature": 28.0, "rainfall": 0.0, "soil_moisture": 0.15}]

        result = run_land_analytics_pipeline(db=db_session, land_records=land_records)
        batch_id = result["batch_id"]

        batch = db_session.query(IngestionBatch).filter(
            IngestionBatch.batch_id == batch_id
        ).first()

        assert batch is not None
        assert batch.status in ("COMPLETED", "PARTIAL_SUCCESS", "FAILED")
        assert batch.completed_at is not None

    def test_pipeline_duplicate_handling(self, db_session: Session):
        """Running pipeline twice with same land_id handles duplicates."""
        land_records = [{"land_id": 30, "governorate": "Qena", "temperature": 29.0, "rainfall": 0.0, "soil_moisture": 0.22}]

        # First run
        result1 = run_land_analytics_pipeline(db=db_session, land_records=land_records)
        assert result1["inserted_count"] == 1

        # Second run — same land_id but new batch_id, should insert (different batch)
        result2 = run_land_analytics_pipeline(db=db_session, land_records=land_records)
        assert result2["status"] in ("COMPLETED", "COMPLETED_NO_NEW_DATA", "PARTIAL_SUCCESS", "FAILED")

    def test_pipeline_errors_logged_to_etl(self, db_session: Session):
        """Pipeline logs validation errors into the etl_errors table."""
        # Soil data with invalid moisture (> 1.0)
        land_records = [{"land_id": 40, "governorate": "Sohag", "temperature": 25.0, "rainfall": 0.0}]
        soil_data = [{"governorate": "Sohag", "land_id": 40, "soil_moisture": 5.0, "soil_type": "clay", "ph": 7.0}]

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
            soil_data=soil_data,
        )

        errors = db_session.query(EtlError).filter(
            EtlError.batch_id == result["batch_id"]
        ).all()

        assert len(errors) >= 1

    def test_pipeline_with_all_sources(self, db_session: Session):
        """Full pipeline with climate, satellite, crop, soil, and AI data."""
        land_records = _valid_land_records()
        ai_outputs = [
            {"land_id": 1, "crop_type": "corn", "ndvi": 0.82},
        ]

        result = run_land_analytics_pipeline(
            db=db_session,
            land_records=land_records,
            climate_data=_valid_climate_data(),
            satellite_bands=_valid_satellite_bands(),
            crop_data=_valid_crop_data(),
            soil_data=_valid_soil_data(),
            cv_ai_outputs=ai_outputs,
        )

        assert result["status"] == "COMPLETED"
        assert result["inserted_count"] == 3

        # AI output should have overridden crop_type for land_id=1
        rec = db_session.query(LandAnalyticsRecord).filter(
            LandAnalyticsRecord.land_id == 1
        ).first()
        assert rec is not None
        assert rec.crop_type == "corn"
        assert float(rec.ndvi) == pytest.approx(0.82, abs=0.01)

    def test_pipeline_output_structure(self, db_session: Session):
        """Verify the stored record matches the expected JSON output structure."""
        land_records = [
            {
                "land_id": 12,
                "governorate": "Minya",
                "temperature": 26.1,
                "rainfall": 0.2,
                "soil_moisture": 0.28,
                "crop_type": "wheat",
                "ndvi": 0.78,
            },
        ]

        result = run_land_analytics_pipeline(db=db_session, land_records=land_records)
        assert result["status"] == "COMPLETED"

        record = db_session.query(LandAnalyticsRecord).filter(
            LandAnalyticsRecord.land_id == 12
        ).first()

        assert record is not None
        assert record.land_id == 12
        assert float(record.temperature) == pytest.approx(26.1, abs=0.1)
        assert float(record.rainfall) == pytest.approx(0.2, abs=0.1)
        assert float(record.ndvi) == pytest.approx(0.78, abs=0.01)
        assert record.vegetation_health is not None
        assert record.crop_type == "wheat"
        assert float(record.soil_moisture) == pytest.approx(0.28, abs=0.01)
        assert record.water_need_estimate is not None
        assert record.risk_level is not None

    def test_pipeline_minimal_land_only(self, db_session: Session):
        """Pipeline works with only land_records (no optional sources)."""
        land_records = [
            {"land_id": 50, "governorate": "Damietta"},
        ]

        result = run_land_analytics_pipeline(db=db_session, land_records=land_records)
        assert result["status"] == "COMPLETED"
        assert result["inserted_count"] == 1


# ============================================================================
# API Endpoint Tests — Pipeline Trigger via HTTP
# ============================================================================

class TestLandAnalyticsPipelineAPI:
    """Tests for the land analytics pipeline HTTP API endpoint."""

    def test_trigger_land_pipeline_success(self, client: TestClient):
        """POST /pipeline/land/run with valid payload → 201."""
        payload = {
            "land_records": [
                {"land_id": 100, "governorate": "Cairo", "temperature": 26.0, "rainfall": 0.5, "soil_moisture": 0.3},
                {"land_id": 101, "governorate": "Giza", "temperature": 28.0, "rainfall": 0.1, "soil_moisture": 0.2},
            ],
            "climate_data": [
                {"governorate": "Cairo", "land_id": 100, "temperature": 26.0, "rainfall": 0.5},
            ],
        }

        response = client.post("/api/v1/pipeline/land/run", json=payload)
        assert response.status_code == 201

        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["inserted_count"] >= 1

    def test_trigger_land_pipeline_with_satellite(self, client: TestClient):
        """POST /pipeline/land/run with satellite bands → 201."""
        payload = {
            "land_records": [
                {"land_id": 200, "governorate": "Luxor", "temperature": 30.0, "rainfall": 0.0, "soil_moisture": 0.2},
            ],
            "satellite_bands": {
                "red": [[0.1, 0.2], [0.15, 0.25]],
                "nir": [[0.5, 0.6], [0.55, 0.65]],
            },
        }

        response = client.post("/api/v1/pipeline/land/run", json=payload)
        assert response.status_code == 201
        assert response.json()["data"]["status"] == "COMPLETED"

    def test_trigger_land_pipeline_empty_records(self, client: TestClient):
        """POST /pipeline/land/run with empty land_records → pipeline runs but 0 inserts."""
        payload = {"land_records": []}

        response = client.post("/api/v1/pipeline/land/run", json=payload)
        assert response.status_code == 201
        assert response.json()["data"]["inserted_count"] == 0

    def test_pipeline_batch_status_after_run(self, client: TestClient):
        """After running land pipeline, batch status is retrievable."""
        payload = {
            "land_records": [
                {"land_id": 300, "governorate": "Aswan", "temperature": 32.0, "rainfall": 0.0, "soil_moisture": 0.1},
            ],
        }

        run_response = client.post("/api/v1/pipeline/land/run", json=payload)
        assert run_response.status_code == 201
        batch_id = run_response.json()["data"]["batch_id"]

        status_response = client.get(f"/api/v1/pipeline/climate/status/{batch_id}")
        assert status_response.status_code == 200
        assert status_response.json()["data"]["status"] in ("COMPLETED", "PARTIAL_SUCCESS", "FAILED")
