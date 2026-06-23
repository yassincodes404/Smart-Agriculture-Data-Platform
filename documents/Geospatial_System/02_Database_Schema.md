# Phase 1: Exact Database Schema Design

This phase replaces generic location models (like `Location` in `location.py`) with a **Land-Centric relational schema** in MySQL. The system uses strict relations and times-series data tracking.

## 1. Core Model: Land
This is the root entity of the system. All pipeline data points back to this record.
**Table:** `lands`
- `land_id` (BigInt auto-increment in MySQL DDL; ORM uses `Integer` in tests for SQLite autoincrement) — Primary Key
- `user_id` (nullable FK to `users.user_id` in ORM; optional in bootstrap SQL)
- `name` (VARCHAR) - Human-readable alias
- `latitude` (DECIMAL(10,8)) - Exact GPS Lat
- `longitude` (DECIMAL(11,8)) - Exact GPS Long
- `boundary_polygon` (JSON or GEOMETRY) - Optional polygon coordinates
- `description` (TEXT)
- `created_at` (TIMESTAMP)

## 2. Modular Datasets (Time-Series Append Only)
Instead of a single massive table, we use domain-specific tables. Each pipeline update **appends** a new row.

### 2a. Climate Data
**Table:** `land_climate`
- `id` (PK)
- `land_id` (FK to `lands.land_id`, indexed)
- `timestamp` (TIMESTAMP, Indexed)
- `temperature_celsius` (DECIMAL)
- `humidity_pct` (DECIMAL)
- `rainfall_mm` (DECIMAL)
- `source_id` (FK to `data_sources`)

### 2b. Water & Irrigation
**Table:** `land_water`
- `id` (PK)
- `land_id` (FK, Indexed)
- `timestamp` (TIMESTAMP, Indexed)
- `estimated_water_usage_liters` (DECIMAL)
- `irrigation_status` (VARCHAR)
- `source_id` (FK to `data_sources`)

### 2c. Agricultural & Crop Data
**Table:** `land_crops`
- `id` (PK)
- `land_id` (FK, Indexed)
- `timestamp` (TIMESTAMP, Indexed)
- `crop_type` (VARCHAR) - Detected by CV or reported
- `ndvi_value` (DECIMAL) - Vegetation index
- `estimated_yield_tons` (DECIMAL)
- `source_id` (FK to `data_sources`)

### 2d. Soil Data (Optional)
**Table:** `land_soil`
- `id` (PK)
- `land_id` (FK, Indexed)
- `timestamp` (TIMESTAMP, Indexed)
- `moisture_pct` (DECIMAL)
- `soil_type` (VARCHAR)
- `source_id` (FK to `data_sources`)

### 2e. Image & CV Assets
**Table:** `land_images`
- `id` (PK)
- `land_id` (FK)
- `timestamp` (TIMESTAMP)
- `image_path` (VARCHAR) - Path in object storage or `data/images/`
- `image_type` (VARCHAR) — e.g. `user_upload`, `satellite_sentinel` (column name in DDL: `image_type`)
- `cv_analysis_summary` (JSON) - Output from `agri_cv` container

### 2f. Provenance / Source Tracking
To ensure accuracy and trace origin.
**Table:** `data_sources`
- `id` (PK)
- `name` (VARCHAR) - e.g., 'Sentinel-2', 'OpenMeteo', 'User Upload'
- `confidence_score` (DECIMAL)

## 3. Key MySQL Implementation Principles
1. **Indexing:** Crucial covering indexes on `(land_id, timestamp)` across all modular tables to enable rapid time-series querying and visualization.
2. **Appending, Not Overwriting:** Old data is never overwritten. Updates insert new rows, allowing the backend to map historical trends.
3. **Data Integrity:** Strict Foreign Keys to enforce `land_id` existence.
