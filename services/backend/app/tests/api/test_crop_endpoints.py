"""
Tests for all 5 crop intelligence API endpoints.
Pre-seeds LandCrop rows directly for deterministic tests.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest

from app.models.land import Land
from app.models.land_crop import LandCrop


# ---------------------------------------------------------------------------
# Polygon for land creation
# ---------------------------------------------------------------------------
_POLYGON = {
    "type": "Polygon",
    "coordinates": [[
        [31.0, 30.0], [31.1, 30.0], [31.1, 30.1], [31.0, 30.1],
    ]],
}

_CLIMATE_MOCK = {"temperature_celsius": 25.0, "humidity_pct": 55.0, "rainfall_mm": 0.0}
_SOIL_MOCK = {"date": "2026-04-24", "et0_mm_per_day": 5.0, "soil_moisture_pct": 28.0}


@pytest.fixture
def land_id_with_history(client, db_session):
    """
    Register a land with mocked connectors, then seed 6 LandCrop rows
    directly so crop endpoints have data without hitting MODIS.
    """
    with patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate",
               return_value=_CLIMATE_MOCK), \
         patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_soil_and_et0",
               return_value=_SOIL_MOCK), \
         patch("app.tasks.satellite_task.modis_ndvi.fetch_ndvi_history",
               return_value=None):    # skip MODIS call in test

        resp = client.post("/api/v1/lands/discover", json={
            "name": "Crop Test Farm",
            "geometry": _POLYGON,
        })
    assert resp.status_code == 202
    land_id = resp.json()["land_id"]

    # Seed 6 NDVI snapshots at 16-day intervals
    ndvi_values = [0.20, 0.35, 0.52, 0.68, 0.65, 0.45]
    growth_stages = ["planting", "early_vegetative", "vegetative",
                     "flowering", "grain_fill", "maturity"]
    base_time = datetime.now(timezone.utc) - timedelta(days=90)

    for i, (ndvi, stage) in enumerate(zip(ndvi_values, growth_stages)):
        row = LandCrop(
            land_id=land_id,
            ndvi_value=Decimal(str(ndvi)),
            growth_stage=stage,
            ndvi_trend="improving" if i < 3 else "declining",
            confidence=Decimal("0.85"),
            timestamp=base_time + timedelta(days=i * 16),
        )
        db_session.add(row)

    db_session.commit()
    return land_id


@pytest.fixture
def empty_land_id(client, db_session):
    """Register a land with no crop history."""
    with patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate",
               return_value=_CLIMATE_MOCK), \
         patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_soil_and_et0",
               return_value=_SOIL_MOCK), \
         patch("app.tasks.satellite_task.modis_ndvi.fetch_ndvi_history",
               return_value=None):
        resp = client.post("/api/v1/lands/discover", json={
            "name": "Empty Land",
            "geometry": _POLYGON,
        })
    assert resp.status_code == 202
    return resp.json()["land_id"]


# ===========================================================================
# 1. Crop Detection
# ===========================================================================

class TestCropDetection:
    def test_returns_200_with_history(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-detection")
        assert resp.status_code == 200
        body = resp.json()
        assert body["land_id"] == land_id_with_history
        assert "ndvi_current" in body
        assert body["ndvi_current"] > 0
        assert "health" in body
        assert "confidence" in body

    def test_returns_no_data_for_empty_land(self, client, db_session, empty_land_id):
        resp = client.get(f"/api/v1/lands/{empty_land_id}/crop-detection")
        assert resp.status_code == 200
        body = resp.json()
        assert body["detection_method"] == "unknown"
        assert body["ndvi_current"] == 0.0

    def test_unknown_land_returns_404(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/crop-detection")
        assert resp.status_code == 404


# ===========================================================================
# 2. Crop Health
# ===========================================================================

class TestCropHealth:
    def test_returns_health_score(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-health")
        assert resp.status_code == 200
        body = resp.json()
        assert 0 <= body["health_score"] <= 100
        assert body["health_status"] in (
            "bare_soil", "very_sparse", "stressed", "developing",
            "healthy", "very_healthy", "dense_canopy", "no_data",
        )
        assert "advice" in body

    def test_unknown_land_returns_404(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/crop-health")
        assert resp.status_code == 404


# ===========================================================================
# 3. Crop Status
# ===========================================================================

class TestCropStatus:
    def test_returns_growth_stage_and_trend(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["growth_stage"] in (
            "planting", "early_vegetative", "vegetative",
            "flowering", "grain_fill", "maturity", "harvest_ready", "unknown",
        )
        assert body["trend"] in ("improving", "stable", "declining", "insufficient_data")
        assert "trend_slope" in body
        assert "monitoring_interval_days" in body
        assert body["monitoring_interval_days"] == 16

    def test_returns_last_updated_timestamp(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-status")
        body = resp.json()
        assert body["last_updated"] != "never"

    def test_unknown_land_returns_404(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/crop-status")
        assert resp.status_code == 404


# ===========================================================================
# 4. Crop Trend
# ===========================================================================

class TestCropTrend:
    def test_returns_ndvi_series(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-trend?days=90")
        assert resp.status_code == 200
        body = resp.json()
        assert "ndvi_series" in body
        assert len(body["ndvi_series"]) >= 1
        for point in body["ndvi_series"]:
            assert "date" in point
            assert "ndvi" in point
            assert "health" in point

    def test_trend_statistics(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-trend")
        body = resp.json()
        assert body["min_ndvi"] <= body["mean_ndvi"] <= body["max_ndvi"]

    def test_anomaly_flag_present(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/crop-trend")
        body = resp.json()
        assert "anomaly_detected" in body
        assert isinstance(body["anomaly_detected"], bool)

    def test_empty_series_for_no_data(self, client, db_session, empty_land_id):
        resp = client.get(f"/api/v1/lands/{empty_land_id}/crop-trend")
        assert resp.status_code == 200
        assert resp.json()["ndvi_series"] == []

    def test_unknown_land_returns_404(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/crop-trend")
        assert resp.status_code == 404


# ===========================================================================
# 5. Harvest Prediction
# ===========================================================================

class TestHarvestPrediction:
    def test_returns_prediction_with_enough_history(self, client, db_session, land_id_with_history):
        resp = client.get(f"/api/v1/lands/{land_id_with_history}/harvest-prediction")
        assert resp.status_code == 200
        body = resp.json()
        assert body["prediction_available"] is True
        assert body["peak_ndvi"] is not None
        assert body["estimated_harvest_start"] is not None
        assert body["confidence_level"] in ("high", "medium", "low")

    def test_returns_unavailable_when_no_history(self, client, db_session, empty_land_id):
        resp = client.get(f"/api/v1/lands/{empty_land_id}/harvest-prediction")
        assert resp.status_code == 200
        body = resp.json()
        assert body["prediction_available"] is False
        assert body["confidence_level"] == "insufficient_data"

    def test_unknown_land_returns_404(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/harvest-prediction")
        assert resp.status_code == 404
