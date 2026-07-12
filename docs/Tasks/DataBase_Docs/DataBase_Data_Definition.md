# Database Data Definition

## Purpose

This document defines the exact allowed data categories, canonical fields, meanings, and source mappings for the database component. It is the anti-hallucination reference for future schema and ETL work.

## Current State

- The current implemented relational dataset is only `test_connection` from [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql).
- No domain tables for agriculture, water, climate, users, or images are implemented yet in repo SQL or SQLAlchemy models.
- The approved target categories below are planned data definitions, not implemented tables unless stated otherwise.

## Target State

The platform may store only the following data categories.

### 1. Shared Control and Lineage Fields

These fields are required across clean operational tables unless explicitly exempted.

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `batch_id` | integer | Ingestion batch identifier | System generated | Operational DB | Target |
| `ingestion_timestamp` | datetime | Timestamp when record entered clean table | System generated | Operational DB | Target |
| `source_system` | string | Name of approved source provider | ETL assignment | Operational DB | Target |
| `source_version` | string | Source file version or release identifier when available | Source metadata | Operational DB | Target |

### 2. Agricultural Production Data

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `crop_id` | integer | Surrogate reference to crop dimension in operational DB | System generated | Operational DB | Target |
| `location_id` | integer | Surrogate reference to location in operational DB | System generated | Operational DB | Target |
| `crop` | string | Crop name source label | FAOSTAT, CAPMAS | Staging, lineage fields | Target |
| `governorate` | string | Egyptian governorate source label | CAPMAS, GADM | Staging, lineage fields | Target |
| `area_feddan` | decimal | Cultivated area in feddan | CAPMAS | Operational DB | Target |
| `area_hectare` | decimal | Cultivated area in hectares | FAOSTAT or normalized ETL output | Operational DB, Warehouse | Target |
| `production_tonnes` | decimal | Production volume in tonnes | FAOSTAT, CAPMAS | Operational DB, Warehouse | Target |
| `year` | integer | Reporting year | FAOSTAT, CAPMAS | Operational DB, Warehouse | Target |

Row granularity:

- Clean table granularity is one row per (`crop_id`, `location_id`, `year`, `batch_id`).

### 3. Water Usage Data

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `crop_id` | integer | Surrogate reference to crop dimension in operational DB | System generated | Operational DB | Target |
| `location_id` | integer | Surrogate reference to location in operational DB | System generated | Operational DB | Target |
| `crop` | string | Crop name source label | CAPMAS or approved water dataset mapping | Staging, lineage fields | Target |
| `water_need_m3_per_ha` | decimal | Water need in cubic meters per hectare | NASA Earthdata, SMAP, approved water datasets | Operational DB, Warehouse | Target |
| `water_per_ton_m3` | decimal | Water used per ton of output | Source-provided or ETL-derived transitional value | Operational DB, Warehouse | Target |
| `irrigation_type` | enum/string | Irrigation method such as `flood` or `drip` | CAPMAS or approved structured input | Operational DB | Target |
| `year` | integer | Reporting year | Source dataset | Operational DB, Warehouse | Target |
| `governorate` | string | Governorate source label | CAPMAS, GADM | Staging, lineage fields | Target |

Row granularity:

- Clean table granularity is one row per (`crop_id`, `location_id`, `year`, `batch_id`) when crop-linked.
- Source records without crop linkage must remain in staging until mapped or rejected; they must not be loaded into clean `water_usage`.

### 4. Climate Data

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `location_id` | integer | Surrogate reference to location in operational DB | System generated | Operational DB | Target |
| `temperature_mean` | decimal | Mean temperature for the reporting period | NASA Earthdata, FEWS NET | Operational DB, Warehouse | Target |
| `humidity_pct` | decimal | Humidity percentage | NASA Earthdata, FEWS NET | Operational DB, Warehouse | Target |
| `year` | integer | Reporting year | Source dataset | Operational DB, Warehouse | Target |
| `governorate` | string | Governorate source label | GADM plus source mapping | Staging, lineage fields | Target |

Row granularity:

- Clean table granularity is one row per (`location_id`, `year`, `batch_id`) at yearly aggregation.

### 5. Satellite and Image Metadata

Files stored on disk:

- raw satellite images
- processed images

Metadata fields stored in DB:

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `image_id` | integer/uuid | Unique image record identifier | System generated | Operational DB | Target |
| `location_id` | integer | Optional link to location dimension | System generated | Operational DB | Target |
| `path_raw` | string | Path to raw image file | Sentinel-2, Google Earth Engine | Operational DB | Target |
| `path_processed` | string | Path to processed image file | Python/OpenCV output | Operational DB | Target |
| `source` | string | Image source provider | Sentinel-2, Google Earth Engine | Operational DB | Target |
| `features_json` | json | Extracted features metadata | Python processing output | Operational DB | Target |
| `timestamp` | datetime | Image acquisition or processing timestamp | Source or processing event | Operational DB | Target |
| `batch_id` | integer | Ingestion batch reference | System generated | Operational DB | Target |

### 6. Derived Analytical Data

| Field | Type | Meaning | Source | Storage Class | State |
| --- | --- | --- | --- | --- | --- |
| `yield_per_hectare` | decimal | Production divided by cultivated area | Derived from production data | Warehouse canonical, optional operational cache | Target |
| `water_efficiency` | decimal | Output relative to water usage | Derived from water and production data | Warehouse canonical, optional operational cache | Target |
| `crop_dominance` | decimal | Share of crop production within a geography | Derived in analytics ETL | Warehouse canonical, optional operational cache | Target |
| `trend_indicator` | string/decimal | Encoded direction or score for multi-period trend | Derived in analytics ETL | Warehouse canonical, optional operational cache | Target |
| `ndvi` | decimal | Vegetation index from imagery | Future derived metric | Warehouse or analytical store | Target Future |

Derived metric ownership rule:

- Canonical source for analytics is the warehouse.
- Operational DB may materialize temporary cache metrics only with explicit `batch_id` and `ingestion_timestamp`.

### 7. Operational System Data

| Field Group | Meaning | Storage Class | State |
| --- | --- | --- | --- |
| user identity and role fields | Access and ownership | Operational DB | Target |
| task tracking fields | Ingestion and processing status tracking | Operational DB | Target |
| backup metadata fields | Backup inventory and restore records | Operational DB | Target |
| ETL error fields | Validation and load failure audit | Operational DB | Target |

## Join Contract

Approved join strategy for clean operational tables:

- `crop_production` to `water_usage` on (`crop_id`, `location_id`, `year`, `batch_id`)
- `crop_production` to `climate_records` on (`location_id`, `year`, `batch_id`)
- `water_usage` to `climate_records` on (`location_id`, `year`, `batch_id`)

Free-text joins on `crop` or `governorate` are not allowed after clean-table loading.

## Current Implemented Table Definition

### `test_connection`

| Field | Type | Meaning | State |
| --- | --- | --- | --- |
| `id` | integer | Auto-increment primary key | Current |
| `status` | varchar(50) | Simple connectivity marker | Current |
| `initialized_at` | timestamp | Row creation timestamp | Current |

## Rules

- Only fields defined in this document may be introduced into schema design without a formal update.
- Every field must map to one of: approved source data, system-generated operational metadata, or Python-derived analytical output.
- No undocumented field may appear in tables, ETL, or API payload planning.
- Files are not to be embedded as binary blobs in MySQL.
- Every clean operational record must include lineage fields (`batch_id`, `ingestion_timestamp`, and `source_system`).
- `Target` fields are approved for design but not automatically considered implemented.

## Dependencies

- [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql)
- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)
- Approved project constraints provided for the database package

## Out of Scope

- Exact API response models
- Full frontend filter vocabulary
- ML feature-set expansion beyond the approved fields above
