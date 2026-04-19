"""Tests for land discovery, Open-Meteo climate snapshot, and timeseries."""

from unittest.mock import patch

import pytest

from app.models.land import Land

pytestmark = pytest.mark.usefixtures("_mock_open_meteo_snapshot")


@pytest.fixture
def _mock_open_meteo_snapshot():
    """Avoid real HTTP in CI; discovery pipeline imports this symbol."""
    fake = {
        "temperature_celsius": 22.5,
        "humidity_pct": 55.0,
        "rainfall_mm": 0.1,
    }
    path = "app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate"
    with patch(path, return_value=fake) as m:
        yield m


def test_discover_land_returns_202(client, db_session):
    resp = client.post(
        "/api/v1/lands/discover",
        json={"latitude": 30.0444, "longitude": 31.2357, "name": "Nile Delta Plot 1"},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "processing"
    land_id = body["land_id"]
    land = db_session.get(Land, land_id)
    assert land is not None
    assert land.name == "Nile Delta Plot 1"


def test_timeseries_unknown_land(client, db_session):
    resp = client.get("/api/v1/lands/999/timeseries")
    assert resp.status_code == 404


def test_timeseries_climate_returns_points_after_discovery(client, db_session):
    discover = client.post(
        "/api/v1/lands/discover",
        json={"latitude": 29.0, "longitude": 30.0, "name": "Test"},
    )
    land_id = discover.json()["land_id"]
    resp = client.get(f"/api/v1/lands/{land_id}/timeseries?metric=climate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["land_id"] == land_id
    assert data["metric"] == "climate"
    assert len(data["points"]) == 1
    pt = data["points"][0]
    assert pt["value"] == 22.5
    assert pt["payload"]["humidity_pct"] == 55.0
    assert pt["payload"]["rainfall_mm"] == 0.1


def test_timeseries_climate_empty_when_connector_returns_none(client, db_session):
    path = "app.pipeline.land_discovery_pipeline.open_meteo.fetch_current_land_climate"
    with patch(path, return_value=None):
        discover = client.post(
            "/api/v1/lands/discover",
            json={"latitude": 24.7, "longitude": 46.7, "name": "No weather"},
        )
    land_id = discover.json()["land_id"]
    resp = client.get(f"/api/v1/lands/{land_id}/timeseries?metric=climate")
    assert resp.status_code == 200
    assert resp.json()["points"] == []
