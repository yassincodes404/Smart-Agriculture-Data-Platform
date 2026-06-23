"""
Tests for soil intelligence API endpoints (soil-profile, soil-suitability, soil-status).
Pre-seeds LandSoilProfile rows directly so no HTTP to ISRIC is needed.
"""

from decimal import Decimal
from unittest.mock import patch

import pytest

from app.models.land_soil_profile import LandSoilProfile


# ---------------------------------------------------------------------------
# Shared fixtures and constants
# ---------------------------------------------------------------------------
_POLYGON = {
    "type": "Polygon",
    "coordinates": [[
        [31.0, 30.0], [31.1, 30.0], [31.1, 30.1], [31.0, 30.1],
    ]],
}
_CLIMATE_MOCK = {"temperature_celsius": 25.0, "humidity_pct": 55.0, "rainfall_mm": 0.0}
_SOIL_MOCK = {"date": "2026-04-24", "et0_mm_per_day": 5.0, "soil_moisture_pct": 28.5}
_SOILGRIDS_MOCK = {
    "lat": 30.05, "lon": 31.05,
    "properties": {
        "phh2o": {"0-5cm": 7.8, "5-15cm": 7.9, "15-30cm": 8.0},
        "soc":   {"0-5cm": 12.5, "5-15cm": 10.2, "15-30cm": 8.3},
        "clay":  {"0-5cm": 30.7, "5-15cm": 32.0, "15-30cm": 31.3},
        "sand":  {"0-5cm": 42.1, "5-15cm": 40.0, "15-30cm": 38.5},
        "silt":  {"0-5cm": 27.2, "5-15cm": 28.0, "15-30cm": 30.2},
        "bdod":  {"0-5cm": 1.32, "5-15cm": 1.37, "15-30cm": 1.41},
        "nitrogen": {"0-5cm": 3.22, "5-15cm": 2.80, "15-30cm": 2.10},
        "cec":   {"0-5cm": 28.5, "5-15cm": 30.1, "15-30cm": 29.0},
    },
    "texture_class": "clay_loam",
    "source": "ISRIC-SoilGrids-v2",
}


@pytest.fixture
def land_with_soil_profile(client, db_session):
    """Register a land, then seed a LandSoilProfile row directly."""
    with patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate",
               return_value=_CLIMATE_MOCK), \
         patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_soil_and_et0",
               return_value=_SOIL_MOCK), \
         patch("app.tasks.satellite_task.modis_ndvi.fetch_ndvi_history", return_value=None), \
         patch("app.tasks.soil_task.soilgrids.fetch_soil_profile", return_value=None):  # skip ISRIC in setup

        resp = client.post("/api/v1/lands/discover", json={
            "name": "Soil Test Farm",
            "geometry": _POLYGON,
        })
    assert resp.status_code == 202
    land_id = resp.json()["land_id"]

    # Seed the soil profile directly
    row = LandSoilProfile(
        land_id=land_id,
        ph_h2o=Decimal("7.80"),
        soc_g_per_kg=Decimal("12.50"),
        clay_pct=Decimal("30.70"),
        sand_pct=Decimal("42.10"),
        silt_pct=Decimal("27.20"),
        bulk_density=Decimal("1.320"),
        nitrogen_g_per_kg=Decimal("3.220"),
        cec_cmol=Decimal("28.500"),
        texture_class="clay_loam",
        depth_profile=_SOILGRIDS_MOCK["properties"],
        suitability_score=Decimal("85.00"),
    )
    db_session.add(row)
    db_session.commit()

    return land_id


@pytest.fixture
def land_without_profile(client, db_session):
    """Register a land with no soil profile row."""
    with patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate",
               return_value=_CLIMATE_MOCK), \
         patch("app.pipeline.land_discovery_pipeline.open_meteo.fetch_soil_and_et0",
               return_value=_SOIL_MOCK), \
         patch("app.tasks.satellite_task.modis_ndvi.fetch_ndvi_history", return_value=None), \
         patch("app.tasks.soil_task.soilgrids.fetch_soil_profile", return_value=None):

        resp = client.post("/api/v1/lands/discover", json={
            "name": "No Soil Land",
            "geometry": _POLYGON,
        })
    assert resp.status_code == 202
    return resp.json()["land_id"]


# ===========================================================================
# 1. Soil Profile
# ===========================================================================

class TestSoilProfile:
    def test_returns_200_with_profile(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-profile")
        assert resp.status_code == 200
        body = resp.json()
        assert body["profile_available"] is True
        assert body["texture_class"] == "clay_loam"
        assert body["source"] == "ISRIC-SoilGrids-v2"
        assert len(body["properties"]) > 0

    def test_all_depth_layers_present(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-profile")
        body = resp.json()
        ph_prop = next((p for p in body["properties"] if p["name"] == "pH"), None)
        assert ph_prop is not None
        assert ph_prop["topsoil_value"] == pytest.approx(7.8, abs=0.01)
        depths = [d["depth"] for d in ph_prop["depths"]]
        assert "0-5cm" in depths
        assert "5-15cm" in depths
        assert "15-30cm" in depths

    def test_ph_classification_in_response(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-profile")
        body = resp.json()
        ph_prop = next((p for p in body["properties"] if p["name"] == "pH"), None)
        assert ph_prop["classification"] in (
            "neutral", "slightly_alkaline", "moderately_alkaline",
            "slightly_acidic", "strongly_alkaline"
        )

    def test_returns_unavailable_when_no_profile(self, client, db_session, land_without_profile):
        resp = client.get(f"/api/v1/lands/{land_without_profile}/soil-profile")
        assert resp.status_code == 200
        assert resp.json()["profile_available"] is False

    def test_404_for_unknown_land(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/soil-profile")
        assert resp.status_code == 404


# ===========================================================================
# 2. Soil Suitability
# ===========================================================================

class TestSoilSuitability:
    def test_returns_top_crops(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-suitability")
        assert resp.status_code == 200
        body = resp.json()
        assert body["profile_available"] is True
        assert len(body["top_crops"]) == 3
        assert len(body["all_crops"]) == 6
        for entry in body["top_crops"]:
            assert "crop" in entry
            assert 0 <= entry["score"] <= 100
            assert "suitability" in entry

    def test_suitability_labels_valid(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-suitability")
        valid_labels = {
            "highly_suitable", "suitable", "marginally_suitable",
            "marginally_unsuitable", "unsuitable",
        }
        for entry in resp.json()["all_crops"]:
            assert entry["suitability"] in valid_labels

    def test_advice_list_not_empty(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-suitability")
        assert len(resp.json()["advice"]) >= 1

    def test_overall_best_score_present(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-suitability")
        body = resp.json()
        assert body["overall_best_score"] is not None
        assert 0 <= body["overall_best_score"] <= 100

    def test_returns_unavailable_when_no_profile(self, client, db_session, land_without_profile):
        resp = client.get(f"/api/v1/lands/{land_without_profile}/soil-suitability")
        assert resp.status_code == 200
        assert resp.json()["profile_available"] is False

    def test_404_for_unknown_land(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/soil-suitability")
        assert resp.status_code == 404


# ===========================================================================
# 3. Soil Status
# ===========================================================================

class TestSoilStatus:
    def test_returns_combined_data(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-status")
        assert resp.status_code == 200
        body = resp.json()
        # Profile data present
        assert body["ph_h2o"] == pytest.approx(7.8, abs=0.01)
        assert body["clay_pct"] == pytest.approx(30.7, abs=0.1)
        assert body["texture_class"] == "clay_loam"
        assert body["profile_source"] == "ISRIC-SoilGrids-v2"

    def test_moisture_populated_from_soil_snapshot(self, client, db_session, land_with_soil_profile):
        """Discovery pipeline wrote a soil moisture row via Open-Meteo mock."""
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-status")
        body = resp.json()
        # Open-Meteo mock returned 28.5% moisture
        assert body["latest_moisture_pct"] == pytest.approx(28.5, abs=0.1)
        assert body["moisture_timestamp"] is not None

    def test_advice_always_present(self, client, db_session, land_with_soil_profile):
        resp = client.get(f"/api/v1/lands/{land_with_soil_profile}/soil-status")
        assert len(resp.json()["advice"]) >= 1

    def test_404_for_unknown_land(self, client, db_session):
        resp = client.get("/api/v1/lands/99999/soil-status")
        assert resp.status_code == 404


# ===========================================================================
# Soil profile task test (unit — mocked ISRIC)
# ===========================================================================

class TestSoilProfileTask:
    def test_task_inserts_profile_row(self, client, db_session, land_without_profile):
        """soil_task.run_soil_profile_task stores profile when ISRIC returns data."""
        from app.tasks.soil_task import run_soil_profile_task

        with patch("app.tasks.soil_task.soilgrids.fetch_soil_profile",
                   return_value=_SOILGRIDS_MOCK):
            result = run_soil_profile_task(land_without_profile, db_session)

        assert result is True

        profile = db_session.execute(
            __import__("sqlalchemy").select(LandSoilProfile).where(
                LandSoilProfile.land_id == land_without_profile
            )
        ).scalar_one_or_none()

        assert profile is not None
        assert float(profile.ph_h2o) == pytest.approx(7.8, abs=0.01)
        assert float(profile.clay_pct) == pytest.approx(30.7, abs=0.1)

    def test_task_returns_false_when_api_fails(self, client, db_session, land_without_profile):
        from app.tasks.soil_task import run_soil_profile_task

        with patch("app.tasks.soil_task.soilgrids.fetch_soil_profile", return_value=None):
            result = run_soil_profile_task(land_without_profile, db_session)

        assert result is False
