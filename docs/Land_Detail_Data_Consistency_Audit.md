# Land Detail Data Consistency Audit

**Date:** 2026-07-08  
**Scope:** Single-land detail page — satellite, climate, water, soil, NDVI, harvest  
**Question:** Is all displayed data correctly scoped to the selected land, and are different sources logically related?

---

## Executive summary

| Area | Verdict |
|------|---------|
| **Land scoping (DB/API)** | Strong — almost all reads/writes use `land_id` tied to the resolved land |
| **Geospatial linkage** | Mixed — Sentinel uses polygon bbox; climate/soil/water use centroid point |
| **Temporal alignment** | Partial — Open-Meteo daily rows align with each other; NDVI vs satellite images use different windows and queries |
| **Logical consistency** | Several UI/backend mismatches (temperature label, soil pH, NDVI on images, multi-zone crops) |
| **Frontend** | Correct land ID in API calls; time filter is client-only and inconsistent across sections |

**Bottom line:** For the **selected land**, backend storage and APIs are **well scoped by `land_id`**. The main risks are **misleading presentation** (multi-zone NDVI mixing, missing image NDVI, max temp label, empty soil chemistry in UI, synthetic fallback) and **temporal/spatial mismatch** (centroid weather vs bbox satellite, 90 vs 365 days).

---

## 1. Land scoping — what is correct

### Backend: `land_id` filtering

All land time-series repositories filter by `land_id`:

- `list_land_climate_rows` — `services/backend/app/lands/repository.py`
- `list_land_water_rows`, `list_land_soil_rows`, `list_land_crop_rows`, `list_land_images`, `list_crop_zones`, `list_land_alerts` — same pattern

### API: `public_id` → `require_land_access` → `land.land_id`

Protected endpoints resolve ownership then pass internal ID:

- `GET /lands/{public_id}/timeseries` — `services/backend/app/api/lands.py`
- `require_land_access` loads by `public_id`, checks `user_id`, returns 404 on failure

### Frontend: single land context

`useLandDetail(landId)` loads all metrics with the route param:

- `services/frontend/web/src/hooks/useLandDetail.js` — `getLandDetail`, timeseries, images, zones, health, harvest
- `fetchAll` runs on `landId` change; no cross-land mixing in state

### Cascade delete

`delete_land_cascading` removes all child tables by `land_id` — consistent lifecycle.

---

## 2. Data sources and pipelines

| Data | Source | Tied to land geometry? | Stored in |
|------|--------|------------------------|-----------|
| Climate, soil moisture, ET₀ | Open-Meteo archive | **Centroid** lat/lon | `land_climate`, `land_soil`, `land_water` |
| Static soil (pH, texture, etc.) | ISRIC SoilGrids | **Centroid** | `land_soil_profiles` |
| Satellite thumbnails | Sentinel-2 STAC (Planetary Computer) | **Polygon bbox** | `land_images` |
| NDVI / crop zones | Sentinel-2 arrays + tile ML | **Polygon bbox** | `land_crops`, `crop_zones` |

### Discovery pipeline (`land_discovery_pipeline.py`)

For each `land_id`:

1. Reads `land.latitude`, `land.longitude`, `boundary_polygon`, `area_hectares`, `metadata_.trackingVariables`
2. **Steps 1–2:** `open_meteo.fetch_historical_climate(lat, lon, days=365)` — one loop writes climate, soil moisture, and water with **the same timestamp per date**
3. **Step 3:** `run_sentinel_visual_fetch(land_id)` — bbox from polygon ring
4. **Step 5:** `run_soil_profile_task(land_id)` — SoilGrids at centroid
5. **Step 6:** `run_crop_detection_task(land_id, days=365)` — Sentinel timeseries over bbox

All inserts use the same `land_id`.

### Geometry caveat

Climate/soil/water are **point samples** at centroid; satellite/NDVI are **area samples** over bbox. Large or irregular fields can show weather that does not represent the full polygon.

---

## 3. Temporal alignment

### Correct: Open-Meteo daily bundle

Per calendar date in discovery:

- `land_climate` ← temp, humidity, rain
- `land_soil` ← `soil_moisture_pct`
- `land_water` ← ET₀, liters, `irrigation_status` from same-day moisture + ET₀

Frontend water cards join soil by date (`buildSoilMoistureIndex`, `resolveWaterRecord`) — matches backend `water_metrics.py`.

### Inconsistent: NDVI vs satellite images

| Aspect | Crop NDVI (`crop_task`) | Gallery images (`sentinel_task`) |
|--------|-------------------------|----------------------------------|
| Default window | **365 days** | **90 days** |
| Cloud filter | `< 20%` | `< 15%` |
| Limit | All STAC items | **30 scenes** |
| Timestamps | Scene datetimes from array pipeline | Scene `properties.datetime` |

Users can see NDVI charts spanning ~1 year while the gallery only shows ~90 days — not the same temporal view.

### Open-Meteo archive lag

`services/backend/app/connectors/open_meteo.py` — `end_date = date.today() - timedelta(days=5)`

Climate/soil/water are missing the **last ~5 days** everywhere.

### Frontend time filter

`filterPointsByTimeRange` / `filterImagesByTimeRange` apply the same `timeRangeDays` to climate, soil, water, crops, and images.

**But** `timeRangeCounts` and `timeRangeSummaryText` use **climate only** as reference (`useLandDetail.js`). Pill counts can disagree with crop/image counts in the same period.

**Crop-health / harvest** are **not** time-filtered on the frontend.

---

## 4. Logical consistency — mismatches

### 4.1 Temperature labeled as daily average, stored as max

Pipeline stores `temperature_max_c` as `temperature_celsius` (`land_discovery_pipeline.py`).

UI shows “Temperature” and “Avg: X°C” — **misleading** vs true daily mean.

### 4.2 Soil: two sources, one UI

- **Time series** (`/timeseries?metric=soil`): only **moisture** written in discovery
- **Static profile** (`/soil-profile`, SoilGrids): pH, texture, SOC — **not fetched** on `LandDetailsPage`

`LandEnvironmentSection` shows `ph_level`, `organic_matter_pct`, `soil_type` from timeseries `payload` — **never populated** by pipeline.

### 4.3 NDVI: three sources that do not line up

1. **`land_crops`** — zone-level Sentinel-derived NDVI (or synthetic fallback)
2. **`land_images.ndvi_mean`** — **never set** on insert (`sentinel_task.py`)
3. **`/ndvi-comparison`** reads `img.ndvi_mean` → effectively **0.0** always

Satellite cards show NDVI badges only when `ndvi_mean` exists — usually absent. Chart NDVI does not match image badges.

### 4.4 Multi-crop zones pollute aggregate series

`crop_task` inserts **one row per zone per timestamp**. `list_land_crop_rows(land_id)` returns **all zones interleaved**.

Effects:

- **`VegetationChart`** plots mixed zones as one series → zigzag / false trends
- **`latestCrop`** = last filtered point — may be a **minor zone**
- **`get_crop_status` / `get_crop_trend`** use full mixed series
- Harvest and zone health **do** filter by `zone_id` — inconsistent with chart/metrics

### 4.5 Synthetic NDVI when Sentinel fails

`crop_task.py` — synthetic fallback stored like real data; UI says “Live from backend API”.

### 4.6 Re-analyze scope

`POST /lands/{public_id}/analyze` refreshes Sentinel + crop detection + AI. It does **not** refresh climate/soil/water.

### 4.7 Fabricated UI values

`AIEstimate` in `LandCropsSection` invents yield when `zone.estimated_yield_tons` is null.

### 4.8 `crop-health` side effects on read

`GET /crop-health` calls `analyze_land`, which **updates `crop_zones`** on every page load — can desync from raw `land_crops`.

---

## 5. Frontend-specific issues

| Issue | Location | Behavior |
|-------|----------|----------|
| Satellite badge uses unfiltered count | `LandSatelliteSection.jsx` | `{images.length}` ignores time filter |
| No `soil-profile` API on land detail | `useLandDetail.js` | Static soil not loaded |
| Water volume in metrics | `LandMetricsSection.jsx` | ET₀ × ha × 10 → m³ — correct |
| Polling refreshes all data | `useLandDetail.js` | On `status === active`, `fetchAll()` |

---

## 6. Security / scoping gaps

### P0: Image content without ownership check

`GET /lands/{public_id}/images/{image_id}/content` — no `require_land_access`.

### P2: Notifications not scoped to user's lands

`GET /notifications` — can show alerts for other users' lands.

### P3: `GET /lands` without auth

List leakage in dev/unauthenticated mode.

---

## 7. What is correct and properly linked

1. Single-land API contract — `public_id` → `land.land_id`
2. Discovery writes — all rows tagged with registering `land_id`
3. Climate ↔ water ↔ soil (daily) — same Open-Meteo date loop
4. Water UI derivation — aligns with backend rules
5. Sentinel imagery & NDVI pipeline — bbox from this land's polygon
6. Crop zones & per-zone harvest — filtered by `zone_id`
7. Map view — correct `boundary_polygon` for selected land
8. Client time filter — same `timeRangeDays` on timeseries + images in `derived`
9. Re-analyze / delete — scoped via `require_land_access`

---

## 8. File / line hotspots

| Severity | Issue | File |
|----------|-------|------|
| High | Image endpoint no auth | `api/lands.py` |
| High | Multi-zone NDVI mixed in chart/metrics | `tasks/crop_task.py`, `useLandDetail.js`, `VegetationChart.jsx` |
| High | `ndvi_mean` never stored | `tasks/sentinel_task.py` |
| High | Synthetic NDVI presented as real | `tasks/crop_task.py` |
| Medium | Max temp shown as “Temperature” | `land_discovery_pipeline.py`, `LandMetricsSection.jsx` |
| Medium | Soil pH UI from empty timeseries | `LandEnvironmentSection.jsx` |
| Medium | 90d images vs 365d NDVI | `sentinel_task.py`, `crop_task.py` |
| Medium | Time filter counts from climate only | `useLandDetail.js` |
| Medium | `crop-health` mutates zones on GET | `api/crops.py`, `intelligence/engine.py` |
| Low | Gallery badge ignores filter | `LandSatelliteSection.jsx` |
| Low | 5-day Open-Meteo lag | `connectors/open_meteo.py` |
| Low | Notifications global | `api/lands.py` |

---

## 9. Data relationship diagram

```
Selected land polygon
        │
        ├── Centroid (lat/lon) ──► Open-Meteo ──► Climate (max temp)
        │                              │         Soil moisture (daily)
        │                              │         Water / ET₀ (daily)
        │                              └── 5-day archive lag
        │
        └── Polygon bbox ──► Sentinel-2 ──► Gallery images (90d, max 30)
                               │            NDVI timeseries (365d)
                               └── ndvi_mean not linked to chart
```

---

## Related documents

- Fix implementation plan: [Land_Detail_Data_Consistency_Fix_Plan.md](./Land_Detail_Data_Consistency_Fix_Plan.md)
- Discovery pipeline: `documents/Geospatial_System/03_Phase2_Discovery_Pipeline.md`
- Database schema: `documents/Geospatial_System/02_Database_Schema.md`