# Agricultural Decision Engine — Core Backend Implementation Plan

> **Goal**: Transform the platform from a data collection app into an **Agricultural Decision Engine** that answers real questions about any registered land.

---

## Current Project State

### What Already Exists ✅

| Layer | Status | Details |
|-------|--------|---------|
| **Land Discovery** | Working | `POST /lands/discover` → persists land, runs background climate fetch via Open-Meteo |
| **Climate Connector** | Working | `app/connectors/open_meteo.py` fetches temp/humidity/rainfall |
| **Time-Series Read** | Partial | `GET /lands/{id}/timeseries?metric=climate` works; `water`, `crops`, `soil` return empty |
| **Monitoring Pipeline** | Placeholder | `land_monitoring_pipeline.py` logs but does no actual data fetching |
| **Scheduler** | Working | APScheduler in Docker `agri_scheduler` calls monitoring cycle on interval |
| **Database Models** | Complete schema | All 8 geospatial models exist (`Land`, `LandClimate`, `LandWater`, `LandCrop`, `LandSoil`, `LandImage`, `AnalyticsSummary`, `DataSource`) |
| **Auth & Users** | Working | JWT auth, registration, login, admin guard |
| **CSV Pipelines** | Working | Climate + Water CSV ingestion via `/pipeline/climate/run` and `/pipeline/water/run` |

### What's Missing ❌

- **No NDVI/satellite data** — crop detection, health, and growth stages are impossible
- **No water model** — water needs, efficiency, irrigation status are unanswerable  
- **No crop requirement data** — suitability and climate matching don't exist
- **No soil connector** — soil moisture/type are empty
- **Monitoring pipeline is a placeholder** — no real periodic data refresh
- **No analytics/intelligence layer** — no trend analysis, anomaly detection, or recommendations
- **No satellite time-series images** — no visual growth tracking
- **Time-series reads only work for climate** — water/crops/soil return `[]`

---

## User Review Required

> [!IMPORTANT]
> **External API Keys**: Sentinel-2 satellite data access via Copernicus Data Space requires a free account and API credentials. You'll need to register at [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) and add `COPERNICUS_CLIENT_ID` and `COPERNICUS_CLIENT_SECRET` to `.env.backend`. We can stub this connector initially and use mock/sample GeoTIFF data for development.

> [!IMPORTANT]  
> **Scope Confirmation**: This plan focuses on **backend only** (models, services, repositories, API endpoints, connectors, pipelines). No frontend changes are included. The endpoints are designed so the frontend can be built independently afterward.

> [!WARNING]
> **AI Summary Engine**: The AI recommendations feature (Tier 3) will use the existing Gemini/OpenAI key in `OPENAI_API_KEY` config. If you want to defer AI features to a later phase, let me know.

---

## Open Questions

> [!IMPORTANT]
> 1. **Satellite Data Source**: Do you want to start with real Copernicus/Sentinel-2 integration, or begin with a stub connector + sample GeoTIFF files for development?
> 2. **NDVI Calculation**: Should NDVI be computed inside the backend (Python with `rasterio`/`numpy`), or delegated to the existing `agri_cv` (OpenCV) container?
> 3. **FAO Crop Data**: Should crop water requirements and growth stage data come from a static JSON/CSV lookup table (embedded in the repo), or from the FAO API?
> 4. **Implementation Order**: I recommend building Tier 1 first (crop health + NDVI + trends), then Tier 2 (yield + water + climate impact), then Tier 3 (AI recommendations). Do you agree?

---

## Feature → Question Mapping (Master Feature List)

### 🥇 Tier 1 — CORE VALUE

| # | Question | Data Sources | Endpoint |
|---|----------|-------------|----------|
| 1.1 | What crop is growing here? | NDVI time-series + ML classification | `GET /lands/{id}/crop-detection` |
| 1.2 | What stage is the crop in? | NDVI curve + crop cycle models | `GET /lands/{id}/crop-status` |
| 1.3 | When is harvest time? | NDVI peak + crop cycle + climate | `GET /lands/{id}/harvest-prediction` |
| 1.4 | Is the crop healthy? | NDVI value vs normal levels | `GET /lands/{id}/crop-health` |
| 1.5 | Is the crop improving or declining? | NDVI time-series trend | `GET /lands/{id}/crop-trend` |
| 1.6 | What changed in this land over time? | NDVI + climate + water time-series | `GET /lands/{id}/timeseries` (extended) |

### 🥈 Tier 2 — STRONG

| # | Question | Data Sources | Endpoint |
|---|----------|-------------|----------|
| 2.1 | How much water does this crop need? | Crop type + FAO ET₀ models | `GET /lands/{id}/water-needs` |
| 2.2 | Is the land over/under-irrigated? | NDVI + climate + water model | `GET /lands/{id}/irrigation-status` |
| 2.3 | What is water efficiency? | Water per ton (estimated yield) | `GET /lands/{id}/water-efficiency` |
| 2.4 | Is the weather suitable for this crop? | Crop requirements vs actual climate | `GET /lands/{id}/climate-suitability` |
| 2.5 | Is there climate stress? | Heatwave/drought signals | `GET /lands/{id}/climate-stress` |
| 2.6 | What is the expected yield? | NDVI + climate + regional stats | `GET /lands/{id}/yield-estimate` |
| 2.7 | Is yield increasing or decreasing? | Time-series analysis | `GET /lands/{id}/yield-trend` |
| 2.8 | How does this land compare to others? | Regional averages comparison | `GET /lands/{id}/regional-comparison` |

### 🥉 Tier 3 — ADVANCED

| # | Question | Data Sources | Endpoint |
|---|----------|-------------|----------|
| 3.1 | Are there anomalies? | Sudden NDVI drop, unusual climate | `GET /lands/{id}/anomalies` |
| 3.2 | Is there risk of crop failure? | Probabilistic model | `GET /lands/{id}/risk-assessment` |
| 3.3 | Give me a summary of this land | All data fusion | `GET /lands/{id}/summary` |
| 3.4 | What should I do next? | AI recommendations | `GET /lands/{id}/recommendations` |
| 3.5 | Is this soil suitable for this crop? | Soil type + moisture + crop reqs | `GET /lands/{id}/soil-suitability` |
| 3.6 | Is soil moisture sufficient? | Satellite soil moisture | `GET /lands/{id}/soil-status` |

### 📸 Satellite Time-Series (Visual Feature)

| # | Feature | Endpoint |
|---|---------|----------|
| 4.1 | List satellite images over time | `GET /lands/{id}/images` |
| 4.2 | Get NDVI image for specific date | `GET /lands/{id}/images/{image_id}` |

---

## Proposed Changes

### Component 1: New Database Models & Schema Extensions

> New columns and tables needed to power the decision engine.

#### [MODIFY] [land_crop.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/models/land_crop.py)

Add columns to support growth stage tracking:
```python
growth_stage = Column(String(50), nullable=True)     # "planting", "vegetative", "flowering", "maturity", "harvest"
ndvi_trend = Column(String(20), nullable=True)        # "improving", "stable", "declining"
confidence = Column(Numeric(5, 4), nullable=True)     # ML confidence score
```

#### [MODIFY] [land_water.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/models/land_water.py)

Add columns for water intelligence:
```python
crop_water_requirement_mm = Column(Numeric(10, 4), nullable=True)  # FAO ET₀ based
water_efficiency_ratio = Column(Numeric(10, 4), nullable=True)     # yield/water
```

#### [MODIFY] [land_soil.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/models/land_soil.py)

Add columns for soil suitability:
```python
ph_level = Column(Numeric(5, 2), nullable=True)
organic_matter_pct = Column(Numeric(5, 2), nullable=True)
suitability_score = Column(Numeric(5, 2), nullable=True)  # 0-100 for detected crop
```

#### [MODIFY] [land_image.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/models/land_image.py)

Add column for satellite band metadata:
```python
ndvi_mean = Column(Numeric(6, 4), nullable=True)      # Mean NDVI for this image
cloud_cover_pct = Column(Numeric(5, 2), nullable=True) # Cloud coverage filter
```

#### [NEW] land_alert.py — `services/backend/app/models/land_alert.py`

New table for anomalies and risk alerts:
```python
class LandAlert(Base):
    __tablename__ = "land_alerts"
    id, land_id, timestamp, alert_type, severity, message, payload, resolved_at
```

#### [MODIFY] [geospatial_schema.sql](file:///e:/Projects/Smart-Agriculture-Data-Platform/Database/geospatial_schema.sql)

Add `ALTER TABLE` statements for new columns + `CREATE TABLE land_alerts`.

#### [MODIFY] [base.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/db/base.py)

Register `LandAlert` model.

---

### Component 2: New Connectors (External Data Sources)

> All connectors live in `app/connectors/` per the guideline: "External HTTP lives in small modules (e.g. app/connectors/)".

#### [NEW] sentinel_ndvi.py — `services/backend/app/connectors/sentinel_ndvi.py`

Sentinel-2 / Copernicus Data Space connector:
- Authenticate via OAuth2 client credentials
- Query catalog for Sentinel-2 L2A products by coordinates + date range
- Download GeoTIFF bands (B04 Red, B08 NIR)
- Compute NDVI: `(NIR - RED) / (NIR + RED)`
- Crop to land boundary, generate NDVI PNG + true-color PNG
- Return: `{ ndvi_mean, ndvi_image_path, true_color_path, cloud_cover_pct }`

#### [NEW] fao_crop_data.py — `services/backend/app/connectors/fao_crop_data.py`

Static crop reference data (bundled JSON/CSV):
- Crop growth stages and typical NDVI ranges per stage
- Crop water requirements (ET₀ coefficients per crop per stage)
- Optimal temperature/humidity ranges per crop
- Harvest timing models

#### [NEW] soil_data.py — `services/backend/app/connectors/soil_data.py`

Soil data connector (SoilGrids REST API / ISRIC):
- Fetch soil type, pH, organic matter for coordinates
- Optional: SMAP satellite soil moisture

#### [MODIFY] [open_meteo.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/connectors/open_meteo.py)

Extend to support:
- Historical climate data (date range query)
- Daily forecast (7-day)
- Climate stress indicators (heatwave detection, drought signals)

---

### Component 3: Analysis Engine (Business Logic)

> New service modules that fuse data from multiple sources to answer questions. These follow the layered pattern: `service.py` (orchestration) → `repository.py` (queries).

#### [NEW] Crop Intelligence Module — `services/backend/app/crops/`

Replaces the current empty placeholder:

##### [NEW] `crops/service.py`
- `detect_crop(land_id)` → ML classification from NDVI pattern
- `get_crop_status(land_id)` → current growth stage from NDVI + FAO model
- `get_crop_health(land_id)` → NDVI vs normal, health score
- `get_crop_trend(land_id)` → time-series regression (improving/declining)
- `predict_harvest(land_id)` → NDVI peak detection + crop cycle

##### [NEW] `crops/repository.py`
- `list_ndvi_history(db, land_id, days)` → recent `land_crops` rows ordered by timestamp
- `get_latest_crop_record(db, land_id)` → most recent `land_crops` entry
- `insert_crop_snapshot(db, land_id, ...)` → append new crop data row

##### [MODIFY] `crops/schemas.py`
- Add response schemas: `CropDetectionResponse`, `CropStatusResponse`, `CropHealthResponse`, `CropTrendResponse`, `HarvestPredictionResponse`

---

##### [NEW] Water Intelligence Module — `services/backend/app/water/`

##### [NEW] `water/service.py`
- `get_water_needs(land_id)` → FAO ET₀ × crop coefficient
- `get_irrigation_status(land_id)` → NDVI + climate + water model fusion
- `get_water_efficiency(land_id)` → estimated yield / estimated water

##### [NEW] `water/repository.py`
- `list_water_history(db, land_id, days)` → recent `land_water` rows
- `get_latest_water_record(db, land_id)`
- `insert_water_snapshot(db, land_id, ...)`

##### [MODIFY] `water/schemas.py`
- Add response schemas: `WaterNeedsResponse`, `IrrigationStatusResponse`, `WaterEfficiencyResponse`

---

##### [NEW] Analytics / Intelligence Module — `services/backend/app/analytics/`

##### [NEW] `analytics/service.py`
- `get_yield_estimate(land_id)` → NDVI + climate + regional stats
- `get_yield_trend(land_id)` → time-series analysis
- `get_regional_comparison(land_id)` → compare with area averages
- `get_climate_suitability(land_id)` → crop requirements vs actual
- `get_climate_stress(land_id)` → heatwave / drought detection
- `get_anomalies(land_id)` → sudden NDVI drop, unusual climate
- `get_risk_assessment(land_id)` → probabilistic crop failure risk
- `get_land_summary(land_id)` → full data fusion summary
- `get_recommendations(land_id)` → AI-powered next actions

##### [NEW] `analytics/repository.py`
- Aggregate queries across `land_climate`, `land_crops`, `land_water`, `land_soil`
- Regional statistics queries
- Alert insertion / retrieval

##### [NEW] `analytics/schemas.py`
- All response schemas for analytics endpoints

---

### Component 4: API Endpoints

> All endpoints are registered under `/api/v1` in `main.py`. Grouped into focused routers.

#### [MODIFY] [api/lands.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/api/lands.py)

Extend the existing lands router with **land-scoped intelligence endpoints**:

```python
# ── Tier 1: Crop & Growth ──
GET  /lands/{land_id}/crop-detection        → crops.service.detect_crop
GET  /lands/{land_id}/crop-status           → crops.service.get_crop_status
GET  /lands/{land_id}/crop-health           → crops.service.get_crop_health
GET  /lands/{land_id}/crop-trend            → crops.service.get_crop_trend
GET  /lands/{land_id}/harvest-prediction    → crops.service.predict_harvest

# ── Tier 2: Water & Irrigation ──
GET  /lands/{land_id}/water-needs           → water.service.get_water_needs
GET  /lands/{land_id}/irrigation-status     → water.service.get_irrigation_status
GET  /lands/{land_id}/water-efficiency      → water.service.get_water_efficiency

# ── Tier 2: Climate Impact ──
GET  /lands/{land_id}/climate-suitability   → analytics.service.get_climate_suitability
GET  /lands/{land_id}/climate-stress        → analytics.service.get_climate_stress

# ── Tier 2: Yield & Production ──
GET  /lands/{land_id}/yield-estimate        → analytics.service.get_yield_estimate
GET  /lands/{land_id}/yield-trend           → analytics.service.get_yield_trend
GET  /lands/{land_id}/regional-comparison   → analytics.service.get_regional_comparison

# ── Tier 3: Intelligence ──
GET  /lands/{land_id}/anomalies             → analytics.service.get_anomalies
GET  /lands/{land_id}/risk-assessment       → analytics.service.get_risk_assessment
GET  /lands/{land_id}/summary               → analytics.service.get_land_summary
GET  /lands/{land_id}/recommendations       → analytics.service.get_recommendations
GET  /lands/{land_id}/soil-suitability      → analytics.service.get_soil_suitability
GET  /lands/{land_id}/soil-status           → analytics.service.get_soil_status

# ── Satellite Images ──
GET  /lands/{land_id}/images                → lands.service.list_land_images
GET  /lands/{land_id}/images/{image_id}     → lands.service.get_land_image
```

> [!NOTE]
> All endpoints are scoped under the existing `/lands/{land_id}/` path. This keeps the API clean and land-centric. Since `api/lands.py` already exists and handles discovery + timeseries, we extend it with additional routes. As the file grows, we can split into `api/lands_intelligence.py` if needed — but for now a single file keeps imports simple.

#### [MODIFY] [main.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/main.py)

No new router registration needed if we add endpoints to the existing `api/lands.py` router. If we split into sub-routers later, only then do we add new includes.

---

### Component 5: Extended Time-Series Reads

#### [MODIFY] [lands/service.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/lands/service.py)

Complete the `land_timeseries()` function for `water`, `crops`, and `soil` metrics (currently returns empty `[]`).

#### [MODIFY] [lands/repository.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/lands/repository.py)

Add query functions:
- `list_land_water_rows(db, land_id)` → ordered water time-series
- `list_land_crop_rows(db, land_id)` → ordered crop time-series
- `list_land_soil_rows(db, land_id)` → ordered soil time-series
- `list_land_images(db, land_id, image_type?)` → filtered images
- `list_land_alerts(db, land_id)` → active alerts

---

### Component 6: Pipeline & Scheduler Upgrades

#### [MODIFY] [land_discovery_pipeline.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/pipeline/land_discovery_pipeline.py)

Extend discovery to also fetch:
1. **Initial NDVI** snapshot (via `sentinel_ndvi` connector)
2. **Soil data** snapshot (via `soil_data` connector)
3. **Crop detection** (initial classification from NDVI + optional image)
4. Insert initial rows into `land_crops`, `land_soil`, `land_images`

#### [MODIFY] [land_monitoring_pipeline.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/pipeline/land_monitoring_pipeline.py)

Replace placeholder with real monitoring logic — for each active land:
1. Fetch latest climate from Open-Meteo (already works in discovery)
2. Fetch latest NDVI from Sentinel-2
3. Compute water estimates from crop type + climate
4. Run anomaly detection (NDVI drop, climate stress)
5. Generate alerts if thresholds are breached
6. Optionally trigger AI summary (Tier 3)

#### [NEW] satellite_timeseries_task.py — `services/backend/app/pipeline/satellite_timeseries_task.py`

Dedicated pipeline task for satellite image time-series:
- For each land, fetch latest Sentinel-2 image
- Generate true-color + NDVI images
- Save to `data/images/lands/{land_id}/YYYY-MM-DD_true.png` and `_ndvi.png`
- Insert `land_images` row
- Filter by cloud coverage (skip if >30%)

#### [MODIFY] [scheduler/jobs.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/scheduler/jobs.py)

Add satellite image refresh job (every 5-10 days) alongside the existing monitoring cycle.

---

### Component 7: Static Reference Data

#### [NEW] `data/reference/crop_profiles.json`

Embedded crop reference data:
```json
{
  "wheat": {
    "ndvi_ranges": { "planting": [0.1, 0.2], "vegetative": [0.3, 0.6], "maturity": [0.6, 0.85], "harvest": [0.3, 0.5] },
    "growth_days": 120,
    "optimal_temp": [15, 25],
    "optimal_humidity": [40, 70],
    "kc_coefficients": { "initial": 0.3, "mid": 1.15, "late": 0.4 },
    "water_requirement_mm_per_day": { "initial": 2, "mid": 6, "late": 3 }
  },
  "rice": { ... },
  "cotton": { ... },
  "maize": { ... }
}
```

---

### Component 8: Configuration Updates

#### [MODIFY] [config.py](file:///e:/Projects/Smart-Agriculture-Data-Platform/services/backend/app/core/config.py)

Add new settings:
```python
# Sentinel-2 / Copernicus
COPERNICUS_CLIENT_ID: str = ""
COPERNICUS_CLIENT_SECRET: str = ""

# Satellite monitoring
SATELLITE_IMAGE_INTERVAL_DAYS: int = 5
SATELLITE_MAX_CLOUD_COVER_PCT: float = 30.0

# Analysis thresholds
NDVI_ANOMALY_DROP_THRESHOLD: float = 0.15
CLIMATE_STRESS_TEMP_THRESHOLD: float = 40.0
DROUGHT_RAINFALL_THRESHOLD_MM: float = 2.0
```

#### [MODIFY] [.env.backend](file:///e:/Projects/Smart-Agriculture-Data-Platform/.env.backend)

Add corresponding environment variables.

---

## File Location Summary

All files and their exact locations:

```text
services/backend/app/
├── api/
│   └── lands.py                          [MODIFY] — add 20+ intelligence endpoints
├── connectors/
│   ├── open_meteo.py                     [MODIFY] — add historical + forecast + stress
│   ├── sentinel_ndvi.py                  [NEW]    — Sentinel-2 satellite NDVI
│   ├── fao_crop_data.py                  [NEW]    — crop profiles lookup
│   └── soil_data.py                      [NEW]    — SoilGrids / ISRIC connector
├── crops/
│   ├── schemas.py                        [MODIFY] — add intelligence response schemas
│   ├── service.py                        [MODIFY] — crop detection, health, trend, harvest
│   └── repository.py                     [MODIFY] — NDVI queries, crop inserts
├── water/
│   ├── schemas.py                        [MODIFY] — add water intelligence schemas
│   ├── service.py                        [MODIFY] — water needs, irrigation, efficiency
│   └── repository.py                     [MODIFY] — water queries, inserts
├── analytics/
│   ├── schemas.py                        [NEW]    — yield, climate, anomaly schemas
│   ├── service.py                        [NEW]    — yield, suitability, anomalies, AI summary
│   └── repository.py                     [NEW]    — aggregate cross-table queries
├── lands/
│   ├── service.py                        [MODIFY] — complete water/crops/soil timeseries + images
│   ├── repository.py                     [MODIFY] — add water/crop/soil/image queries
│   └── schemas.py                        [MODIFY] — add image response schemas
├── models/
│   ├── land_crop.py                      [MODIFY] — add growth_stage, ndvi_trend, confidence
│   ├── land_water.py                     [MODIFY] — add crop_water_requirement, efficiency
│   ├── land_soil.py                      [MODIFY] — add ph, organic_matter, suitability
│   ├── land_image.py                     [MODIFY] — add ndvi_mean, cloud_cover_pct
│   └── land_alert.py                     [NEW]    — anomalies & risk alerts table
├── pipeline/
│   ├── land_discovery_pipeline.py        [MODIFY] — extend with NDVI + soil + crop detection
│   ├── land_monitoring_pipeline.py       [MODIFY] — replace placeholder with real logic
│   └── satellite_timeseries_task.py      [NEW]    — periodic satellite image fetch
├── scheduler/
│   └── jobs.py                           [MODIFY] — add satellite image refresh job
├── core/
│   └── config.py                         [MODIFY] — add Copernicus + threshold settings
├── db/
│   └── base.py                           [MODIFY] — register LandAlert
└── main.py                               [NO CHANGE]

Database/
└── geospatial_schema.sql                 [MODIFY] — add columns + land_alerts table

data/
└── reference/
    └── crop_profiles.json                [NEW]    — embedded crop knowledge base

.env.backend                              [MODIFY] — add new env vars
```

---

## Phased Rollout (Implementation Order)

### Phase A — Foundation (Prerequisites)
1. Extend database models (new columns + `land_alerts`)
2. Update `geospatial_schema.sql`
3. Create `crop_profiles.json` reference data
4. Extend `config.py` with new settings
5. Add new connectors (stub implementations with mock data first)

### Phase B — Tier 1: Crop & Growth Intelligence
6. Implement `crops/repository.py` (NDVI queries)
7. Implement `crops/service.py` (detection, status, health, trend, harvest)
8. Add Tier 1 endpoints to `api/lands.py`
9. Complete `land_timeseries()` for crops metric
10. Write tests for all Tier 1 endpoints

### Phase C — Tier 2: Water + Climate + Yield
11. Implement `water/repository.py` + `water/service.py`
12. Implement `analytics/repository.py` + `analytics/service.py` (yield, climate parts)
13. Add Tier 2 endpoints
14. Complete `land_timeseries()` for water and soil metrics
15. Write tests

### Phase D — Pipeline & Monitoring
16. Extend `land_discovery_pipeline.py` with NDVI + soil + crop detection
17. Replace `land_monitoring_pipeline.py` placeholder with real logic
18. Create `satellite_timeseries_task.py`
19. Add satellite job to scheduler
20. Write pipeline tests

### Phase E — Tier 3: Intelligence & AI
21. Implement anomaly detection in `analytics/service.py`
22. Implement risk assessment
23. Implement AI summary + recommendations (Gemini integration)
24. Add Tier 3 endpoints
25. Write tests

---

## Verification Plan

### Automated Tests

Each phase will include pytest tests following the existing pattern in `app/tests/`:

```bash
# Run all tests
cd services/backend
python -m pytest app/tests/ -q

# Run specific feature tests
python -m pytest app/tests/api/test_lands_intelligence.py -q
python -m pytest app/tests/pipeline/test_monitoring_pipeline.py -q
```

- All external HTTP calls (Open-Meteo, Sentinel, SoilGrids) will be mocked via `unittest.mock.patch`
- Tests use in-memory SQLite via `conftest.py` (existing pattern)
- Each new endpoint gets at least one happy-path + one error-case test

### Manual Verification
- Docker build verification: `docker-compose build backend scheduler`
- API docs verification: check Swagger at `/api/docs` after startup
- End-to-end: discover a land → wait for pipeline → query all intelligence endpoints
