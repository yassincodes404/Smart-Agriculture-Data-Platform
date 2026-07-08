# Land Detail Data Consistency — Fix Plan

**Date:** 2026-07-08  
**Based on:** [Land_Detail_Data_Consistency_Audit.md](./Land_Detail_Data_Consistency_Audit.md)  
**Goal:** Make all land-detail sections truthful, aligned, and clearly sourced for the **selected land only**.

---

## Principles

1. **One land, one truth** — every query and UI section must use the same `land_id` / `public_id` (already mostly true).
2. **Label the source** — when data comes from centroid vs bbox, or ET₀ vs metered water, say so in UI.
3. **No fake data** — remove or clearly mark synthetic / AI-estimated values.
4. **Align time** — same default windows per source family, or explicit date-range labels per section.
5. **Primary zone first** — multi-crop lands default to primary zone in charts and key metrics.

---

## Phase 0 — Security & trust (P0)

**Effort:** ~1 day | **Risk if skipped:** Data leakage, broken user trust

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 0.1 | Add `require_land_access` to image content endpoint | `api/lands.py` | Unauthorized user gets 403; owner can load PNG |
| 0.2 | Filter notifications by current user's `land_id`s | `api/lands.py`, `lands/repository.py` | Bell shows only alerts for user's lands |
| 0.3 | Gate `GET /lands` list without auth (dev-only flag) | `api/lands.py`, config | Production requires auth for list |

**Tests:** API tests for image auth + notification scoping.

---

## Phase 1 — NDVI & satellite integrity (P1)

**Effort:** ~3–4 days | **Highest user-visible consistency gain**

### 1.1 Primary-zone filtering (frontend + API option)

| Task | Detail |
|------|--------|
| **Backend** | Add optional `?zone_id=` to `GET /timeseries?metric=crops`; default = primary zone (largest `area_pct` or `avg_confidence`) |
| **Backend** | `get_crop_trend`, `get_crop_status` filter by primary `zone_id` |
| **Frontend** | `useLandDetail`: filter `filteredCrops` to `primaryZone.zone_id` for chart + `latestCrop` |
| **Frontend** | `VegetationChart` subtitle: crop type + zone label |
| **Frontend** | Zone selector dropdown when `cropZones.length > 1` |

**Files:** `lands/service.py`, `api/lands.py`, `crops/service.py`, `useLandDetail.js`, `LandCropsSection.jsx`, `LandMetricsSection.jsx`

**Acceptance:** Multi-zone land shows one smooth NDVI line per selected zone; Key Metrics NDVI matches that zone.

### 1.2 Link satellite images to NDVI values

| Task | Detail |
|------|--------|
| **Backend** | On `insert_land_image` for `image_type=ndvi`, compute/store `ndvi_mean` from raster or join nearest `land_crops` row by date ±1 day |
| **Backend** | Backfill script: `scripts/backfill_image_ndvi_mean.py` for existing lands |
| **Backend** | Fix `/ndvi-comparison` to use joined values when `ndvi_mean` null |
| **Frontend** | Show NDVI badge on image cards when value exists; tooltip with source |

**Files:** `tasks/sentinel_task.py`, `lands/repository.py`, `crops/service.py`, `LandSatelliteSection.jsx`

**Acceptance:** Image card NDVI within ±0.05 of chart point on same date (when both exist).

### 1.3 Unify Sentinel time windows

| Task | Detail |
|------|--------|
| **Backend** | Change `run_sentinel_visual_fetch` default `days=365` (match `crop_task`) |
| **Backend** | Align cloud threshold (pick 20% or document difference) |
| **Frontend** | Section captions: “Sentinel-2 · {start}–{end} · {n} scenes” |

**Files:** `tasks/sentinel_task.py`, `pipeline/land_discovery_pipeline.py`, `LandSatelliteSection.jsx`

**Acceptance:** Gallery date range overlaps NDVI chart range for same land after discovery.

### 1.4 Synthetic NDVI transparency

| Task | Detail |
|------|--------|
| **Backend** | Add `data_source` or `is_synthetic` flag on `land_crops` inserts from fallback |
| **API** | Expose `payload.source: "synthetic" \| "sentinel"` on crop timeseries |
| **Frontend** | Banner on crops section when any point is synthetic; remove “Live from backend API” for synthetic |

**Files:** `tasks/crop_task.py`, `models/land_crop.py`, migration, `LandCropsSection.jsx`, `LandMetricsSection.jsx`

---

## Phase 2 — Environment data accuracy (P1)

**Effort:** ~2–3 days

### 2.1 Temperature labeling & storage

| Option A (quick) | Relabel UI: “Max temp (°C)”, “Avg max temp” in environment |
| Option B (better) | Store `temperature_min_c` + `temperature_mean_c` in `land_climate`; pipeline already has min from Open-Meteo |

| Task | Detail |
|------|--------|
| **Backend** | Extend `insert_land_climate_snapshot` with min/mean columns (migration) |
| **Backend** | Pipeline: persist min + compute mean from min/max |
| **API** | Add fields to climate timeseries payload |
| **Frontend** | Metrics card: “Max / Mean temp”; climate cards show range |

**Files:** `models/land_climate.py`, `land_discovery_pipeline.py`, `connectors/open_meteo.py`, `LandEnvironmentSection.jsx`, `LandMetricsSection.jsx`

### 2.2 Soil: separate live vs static

| Task | Detail |
|------|--------|
| **Frontend** | Fetch `GET /lands/{id}/soil-profile` in `useLandDetail` |
| **Frontend** | Split `LandEnvironmentSection`: “Live moisture (Open-Meteo)” + “Soil profile (SoilGrids)” |
| **Frontend** | Remove pH/texture from timeseries cards unless payload populated |
| **Backend** | Optional: copy static profile snapshot into first soil row at discovery for export parity |

**Files:** `useLandDetail.js`, `LandEnvironmentSection.jsx`, `api` soil endpoints

**Acceptance:** pH and texture only shown when SoilGrids data exists; moisture chart unchanged.

### 2.3 Open-Meteo freshness

| Task | Detail |
|------|--------|
| **Backend** | Reduce archive lag from 5d → 2d where API allows; document in UI |
| **Backend** | Re-analyze / monitoring: optional `refresh_environment` step |
| **Frontend** | “Environment data through {date}” footer on climate/soil/water sections |

**Files:** `connectors/open_meteo.py`, `land_discovery_pipeline.py`, re-analyze endpoint, section footers

### 2.4 Re-analyze parity

| Task | Detail |
|------|--------|
| **Backend** | `POST /analyze` accepts `?refresh=environment,satellite,crops` (default all) |
| **Frontend** | Re-analyze modal: checkboxes for what to refresh |

---

## Phase 3 — UI consistency & time filter (P2)

**Effort:** ~1–2 days

| # | Task | Files |
|---|------|-------|
| 3.1 | Satellite badge uses `filteredImages.length` | `LandSatelliteSection.jsx` |
| 3.2 | Time filter counts per metric: “7 climate · 7 water · 12 NDVI · 4 images” | `useLandDetail.js`, `LandTimeRangeFilter.jsx` |
| 3.3 | Apply time filter to harvest/health display (or label “full history”) | `LandCropsSection.jsx` |
| 3.4 | Section source labels (Open-Meteo centroid vs Sentinel bbox) | All land-detail sections |
| 3.5 | Remove `AIEstimate` for yield; show “—” or backend value only | `LandCropsSection.jsx` |

---

## Phase 4 — Backend read-path hygiene (P2)

**Effort:** ~1–2 days

| # | Task | Detail |
|---|------|--------|
| 4.1 | `GET /crop-health` read-only | `analyze_land(..., persist=False)` — no `_update_crop_zones` on GET |
| 4.2 | Separate `POST /crop-health/refresh` for explicit recompute | New endpoint |
| 4.3 | Harvest API already fixed — add integration test with multi-zone land | `tests/api/test_crop_endpoints.py` |

---

## Phase 5 — Platform maturity (P3)

**Effort:** ongoing

| # | Task |
|---|------|
| 5.1 | Implement `land_monitoring_pipeline` for scheduled aligned snapshots |
| 5.2 | Centroid vs polygon: sample Open-Meteo at bbox center + corners, average (optional) |
| 5.3 | Remove synthetic notification fallback (`land_id: 1`) |
| 5.4 | Update pipeline docstrings (MODIS → Sentinel) |
| 5.5 | Excel export: include `data_source`, `zone_id`, source labels per sheet |

---

## Suggested implementation order (DAG)

```
Phase 0 (security)
    ↓
Phase 1.1 (primary zone NDVI) ──┐
Phase 1.4 (synthetic flag)      ├──► Phase 3 (UI polish)
Phase 2.1 (temperature)         │
Phase 2.2 (soil profile)       │
    ↓                            │
Phase 1.2 (image ndvi_mean) ◄───┘
Phase 1.3 (window alignment)
    ↓
Phase 2.3–2.4 (freshness + re-analyze)
    ↓
Phase 4 (read-only health)
    ↓
Phase 5 (monitoring pipeline)
```

---

## PR stack recommendation

| PR | Title | Phase |
|----|-------|-------|
| PR-1 | `fix/security-land-image-and-notifications` | 0 |
| PR-2 | `feat/crops-timeseries-zone-filter` | 1.1 |
| PR-3 | `feat/sentinel-ndvi-mean-on-images` | 1.2 |
| PR-4 | `fix/sentinel-365d-window-alignment` | 1.3 |
| PR-5 | `feat/synthetic-ndvi-labeling` | 1.4 |
| PR-6 | `feat/climate-min-mean-temp` | 2.1 |
| PR-7 | `feat/soil-profile-on-land-detail` | 2.2 |
| PR-8 | `feat/environment-refresh-on-reanalyze` | 2.3–2.4 |
| PR-9 | `fix/land-detail-ui-source-labels` | 3 |
| PR-10 | `fix/crop-health-readonly-get` | 4 |

Each PR should include tests and a short “consistency checklist” in the PR description.

---

## Verification checklist (per land)

After fixes, manually verify on one multi-zone land:

- [ ] Map polygon matches land name and coordinates in header
- [ ] Climate, soil moisture, water rows share dates in selected time range
- [ ] Water ET₀ × area matches water section volume for same day
- [ ] NDVI chart uses one zone (or selected zone); no zigzag from zone mixing
- [ ] Satellite image date has NDVI badge matching chart (±0.05)
- [ ] Gallery and NDVI date ranges overlap (365d)
- [ ] Temperature labeled “max” or shows min–max range
- [ ] Soil pH only from SoilGrids section, not empty timeseries
- [ ] No ✨ on yield or harvest when API returns null
- [ ] Re-analyze refreshes chosen sections; footer shows data-through date
- [ ] Time filter pill counts match each section
- [ ] Switching lands clears and reloads all sections (no stale prior land)

---

## Estimated total effort

| Phase | Days (dev) |
|-------|------------|
| 0 | 1 |
| 1 | 4 |
| 2 | 3 |
| 3 | 2 |
| 4 | 2 |
| 5 | 5+ (ongoing) |
| **Total (P0–P2)** | **~12 days** |

---

## Related documents

- Audit report: [Land_Detail_Data_Consistency_Audit.md](./Land_Detail_Data_Consistency_Audit.md)
- Discovery pipeline: `documents/Geospatial_System/03_Phase2_Discovery_Pipeline.md`