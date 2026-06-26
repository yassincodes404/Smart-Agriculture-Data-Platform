# Smart Agriculture Data Platform
## Relational Database Architecture Compliance Report

**Project Title:** Smart Agriculture Data Platform Database Architecture  
**Status:** Code-Aligned & Fully Verified  
**Date:** June 26, 2026  

---

## 1. Executive Summary & Schema Overview

This report serves as the formal architectural documentation for the relational database schema of the Smart Agriculture Data Platform. It details the database design, data definition language (DDL) specifications, and compliance with the SQLAlchemy Object-Relational Mapping (ORM) backend models.

The database is structured to support multi-source agricultural data streams, historical environmental telemetry, crop zone detection models, and regional agricultural data analysis.

To assist engineering and development teams in navigating the schema, the Entity-Relationship Diagram (ERD) is attached and linked as a visual reference alongside this document:
* **ERD Visual Reference:** [ERD_FINAL.png](Database_ERD.png)

### Repository and Schema Structure
The workspace layout isolates database definition assets under the `Database/` directory. This includes the database bootstrap initialization script ([init.sql](../../Database/init.sql)) and the geospatial data definition script ([geospatial_schema.sql](../../Database/geospatial_schema.sql)).

---

## 2. Relational Schema Architecture & Integration Paradigm

The database schema layer integrates regional batch-loaded ETL data flows with a parcel-level, time-series geospatial monitoring system. 

```text
       Docker Init Queue (Alphabetical Script Execution)
      ┌─────────────────────────────────────────────────┐
      │  00_init.sql                                    │
      │  - Creates users, locations, etl, etc.          │
      │  - Pre-creates lands (injects area, interval)   │
      │  - Pre-creates land_crops (injects zone_id)     │
      └────────────────────────┬────────────────────────┘
                               │
                               ▼
      ┌─────────────────────────────────────────────────┐
      │  20_geospatial_schema.sql                       │
      │  - Bypasses lands & land_crops (already exist)  │
      │  - Creates modular time-series data tables      │
      └─────────────────────────────────────────────────┘
```

To maintain structural integrity and ensure seamless integration across modules, a non-destructive **DDL Pre-creation Workaround** is implemented within [init.sql](../../Database/init.sql):

1. **Deterministic Execution Ordering:** Within the containerized environment, SQL scripts located in the `/docker-entrypoint-initdb.d/` volume execute in alphabetical order. The core schema script is mapped as `00_init.sql` (derived from [init.sql](../../Database/init.sql)) and the geospatial schema script is mapped as `20_geospatial_schema.sql` (derived from [geospatial_schema.sql](../../Database/geospatial_schema.sql)).
2. **Schema Pre-emption:** The `00_init.sql` script pre-emptively creates the full, code-aligned structures of the `lands` and `land_crops` tables. When `20_geospatial_schema.sql` runs subsequently, its `CREATE TABLE IF NOT EXISTS` commands are ignored by MySQL because the target tables already exist.
3. **Drift Resolution:** This mechanism successfully injects the columns required by the backend ORM models (such as `area_hectares` and `monitoring_interval_days` in `lands`, and the `zone_id` foreign key in `land_crops`) without modifying the baseline geospatial schema file.
4. **Relational Constraints Safety:** Temporarily disabling foreign key checks (`SET FOREIGN_KEY_CHECKS = 0; ... SET FOREIGN_KEY_CHECKS = 1;`) allows tables containing foreign keys pointing to tables defined later in the initialization sequence (like `data_sources`) to initialize without execution failures.

---

## 3. Exhaustive System Database Dictionary

The Smart Agriculture Data Platform database architecture consists of exactly **17 relational tables**:

### 1. `users`
* **Operational Purpose:** Stores system credentials, roles, and status to manage secure JWT authentication and parcel ownership.
* **Attributes:**
  * `user_id` (BIGINT, PK, AUTO_INCREMENT): Unique identifier for the user.
  * `email` (VARCHAR(255), UNIQUE, NOT NULL): User email address (primary login credential).
  * `password_hash` (VARCHAR(255), NOT NULL): Bcrypt-hashed password.
  * `role` (VARCHAR(50), NOT NULL): Permissions class (e.g., `admin`, `analyst`, `viewer`).
  * `is_active` (BOOLEAN, NOT NULL): Status toggle indicating if the user account is active.
  * `created_at` (TIMESTAMP): Datetime when the account was registered.
  * `updated_at` (TIMESTAMP): Datetime when the account metadata was last modified.

### 2. `locations`
* **Operational Purpose:** Maps official geographic administrative boundaries (governorates) to standardize macro-level joins for crop and weather uploads.
* **Attributes:**
  * `location_id` (BIGINT, PK, AUTO_INCREMENT): Unique administrative boundary identifier.
  * `governorate` (VARCHAR(100), UNIQUE, NOT NULL): The official governorate name (e.g., `Giza`).
  * `region` (VARCHAR(100), NULL): Optional secondary regional sub-district name.
  * `created_at` (TIMESTAMP): Date when the location record was registered.

### 3. `ingestion_batches`
* **Operational Purpose:** Tracks execution metrics, timestamps, and status for all automated and manual data ingestion pipelines.
* **Attributes:**
  * `batch_id` (BIGINT, PK, AUTO_INCREMENT): Unique ingestion execution ID.
  * `source_system` (VARCHAR(100), NOT NULL): Name of the data source (e.g., `CSV_Upload`, `Open-Meteo`).
  * `source_version` (VARCHAR(100), NULL): Version string of the loader connector.
  * `started_at` (TIMESTAMP): Ingestion run start time.
  * `completed_at` (TIMESTAMP, NULL): Ingestion run completion time.
  * `status` (VARCHAR(50), NOT NULL): Execution status flag (`COMPLETED`, `FAILED`, `PARTIAL_SUCCESS`).

### 4. `etl_errors`
* **Operational Purpose:** Captures and logs pipeline parsing, normalization, and validation errors for audit trails.
* **Attributes:**
  * `etl_error_id` (BIGINT, PK, AUTO_INCREMENT): Unique error entry identifier.
  * `batch_id` (BIGINT, NULL, FK -> `ingestion_batches`): Execution run context.
  * `stage_name` (VARCHAR(100), NOT NULL): Ingestion pipeline stage (e.g., `CSV_PARSE`, `VALIDATION`).
  * `record_key` (VARCHAR(255), NULL): Raw data row index value that triggered the parsing failure.
  * `error_code` (VARCHAR(100), NOT NULL): System error categorization code.
  * `error_message` (TEXT, NOT NULL): Logging error description.
  * `is_retryable` (BOOLEAN, NOT NULL): Determines if the row can be processed again on retry.
  * `created_at` (TIMESTAMP): Time when the error was written to the database.

### 5. `climate_records`
* **Operational Purpose:** Stores governorate-level, aggregated annual temperature and relative humidity metrics.
* **Attributes:**
  * `climate_record_id` (BIGINT, PK, AUTO_INCREMENT): Unique climate record identifier.
  * `location_id` (BIGINT, NOT NULL, FK -> `locations`): Target governorate.
  * `year` (INT, NOT NULL): Calendar year.
  * `temperature_mean` (DECIMAL(10,4), NULL): Mean yearly temperature (°C).
  * `humidity_pct` (DECIMAL(10,4), NULL): Mean relative humidity percentage.
  * `batch_id` (BIGINT, NOT NULL, FK -> `ingestion_batches`): Ingestion execution run context.
  * `source_system` (VARCHAR(100), NOT NULL): Ingestion loader tracking.
  * `ingestion_timestamp` (TIMESTAMP, NOT NULL): Ingestion timestamp.
  * `created_at` (TIMESTAMP): Record creation timestamp.

### 6. `water_records`
* **Operational Purpose:** Stores governorate-level, aggregated annual crop water consumption metrics.
* **Attributes:**
  * `water_record_id` (BIGINT, PK, AUTO_INCREMENT): Unique water consumption record ID.
  * `location_id` (BIGINT, NOT NULL, FK -> `locations`): Target governorate.
  * `crop` (VARCHAR(100), NOT NULL): Crop name flat text (e.g., `Wheat`).
  * `year` (INT, NOT NULL): Calendar year.
  * `water_consumption_m3` (DECIMAL(12,2), NULL): Volume of water consumed ($m^3$).
  * `irrigation_type` (VARCHAR(50), NULL): Method of irrigation (e.g., `drip`, `sprinkler`).
  * `batch_id` (BIGINT, NOT NULL, FK -> `ingestion_batches`): Ingestion execution run context.
  * `source_system` (VARCHAR(100), NOT NULL): Ingestion loader tracking.
  * `ingestion_timestamp` (TIMESTAMP, NOT NULL): Ingestion timestamp.
  * `created_at` (TIMESTAMP): Record creation timestamp.

### 7. `lands`
* **Operational Purpose:** Root entity representing the registered land parcel, containing geospatial centroid, area, and status.
* **Attributes:**
  * `land_id` (BIGINT, PK, AUTO_INCREMENT): Unique land parcel identifier.
  * `user_id` (BIGINT, NULL, FK -> `users`): Owner profile.
  * `name` (VARCHAR(255), NOT NULL): User-defined name of the parcel.
  * `latitude` (DECIMAL(10,8), NOT NULL): Bounded centroid latitude.
  * `longitude` (DECIMAL(11,8), NOT NULL): Bounded centroid longitude.
  * `boundary_polygon` (JSON, NULL): GeoJSON coordinates outlining the boundary.
  * `area_hectares` (DECIMAL(12,4), NULL): Calculated area of the parcel in hectares.
  * `description` (TEXT, NULL): Textual notes.
  * `status` (VARCHAR(32), NOT NULL): Ingestion state (`active`, `processing`, or `ready`).
  * `monitoring_interval_days` (INT, NOT NULL): Target frequency in days for scheduling updates.
  * `created_at` (TIMESTAMP): Timestamp of parcel registration.

### 8. `data_sources`
* **Operational Purpose:** Tracks metadata and confidence scores for various data providers.
* **Attributes:**
  * `source_id` (BIGINT, PK, AUTO_INCREMENT): Unique provider identifier.
  * `name` (VARCHAR(255), NOT NULL UNIQUE): Name of data provider (e.g., `Sentinel-2 (ESA)`, `Open-Meteo`).
  * `confidence_score` (DECIMAL(5,2), NULL): Score indicating the reliability of the source.
  * `created_at` (TIMESTAMP): Record creation timestamp.

### 9. `land_climate`
* **Operational Purpose:** Stores historical, append-only climate snapshot updates at specific land coordinates.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique record identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Telemetry collection timestamp.
  * `temperature_celsius` (DECIMAL(10,4), NULL): Air temperature.
  * `humidity_pct` (DECIMAL(10,4), NULL): Relative humidity.
  * `rainfall_mm` (DECIMAL(10,4), NULL): Rainfall depth (mm).
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 10. `land_water`
* **Operational Purpose:** Stores historical, append-only irrigation and evapotranspiration records for registered lands.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique record identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Telemetry collection timestamp.
  * `estimated_water_usage_liters` (DECIMAL(14,4), NULL): Estimated water volume used in liters.
  * `irrigation_status` (VARCHAR(100), NULL): Status of irrigation (e.g., `irrigated`, `drying_down`).
  * `crop_water_requirement_mm` (DECIMAL(10,4), NULL): Evapotranspiration ($ET_0$) proxy.
  * `water_efficiency_ratio` (DECIMAL(10,4), NULL): Crop yield per unit water used.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 11. `crop_zones`
* **Operational Purpose:** Tracks agricultural sub-plots with distinct crops inside a single land parcel.
* **Attributes:**
  * `zone_id` (BIGINT, PK, AUTO_INCREMENT): Unique zone ID.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `crop_type` (VARCHAR(100), NOT NULL): Detected crop.
  * `area_hectares` (DECIMAL(12,4), NULL): Acreage of this crop zone.
  * `area_pct` (DECIMAL(5,2), NULL): Acreage percentage of total land.
  * `boundary_polygon` (JSON, NULL): Bounding geo-coordinates for the zone.
  * `status` (VARCHAR(32), NOT NULL): Status of the zone (`active`, `inactive`).
  * `avg_confidence` (DECIMAL(5,4), NULL): Average detection confidence.
  * `latest_ndvi` (DECIMAL(6,4), NULL): Latest zone NDVI value.
  * `latest_growth_stage` (VARCHAR(50), NULL): Zone growth stage.
  * `estimated_yield_tons` (DECIMAL(14,4), NULL): Expected yield volume.
  * `first_detected` (TIMESTAMP): Initial detection date.
  * `last_updated` (TIMESTAMP): Date of last update.

### 12. `land_crops`
* **Operational Purpose:** Stores historical, append-only crop telemetry, NDVI indices, and yield predictions.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique record identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Telemetry collection timestamp.
  * `crop_type` (VARCHAR(100), NULL): Detected crop.
  * `ndvi_value` (DECIMAL(10,4), NULL): Mean Normalized Difference Vegetation Index.
  * `estimated_yield_tons` (DECIMAL(14,4), NULL): Expected yield volume.
  * `growth_stage` (VARCHAR(50), NULL): Growth stage descriptor.
  * `ndvi_trend` (VARCHAR(20), NULL): NDVI regression direction (e.g., `rising`, `falling`).
  * `confidence` (DECIMAL(5,4), NULL): ML detection confidence.
  * `zone_id` (BIGINT, NULL, FK -> `crop_zones`): Associated crop zone.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 13. `land_soil`
* **Operational Purpose:** Stores historical, append-only soil moisture index snapshots.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique record identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Telemetry collection timestamp.
  * `moisture_pct` (DECIMAL(10,4), NULL): Topsoil moisture percentage.
  * `soil_type` (VARCHAR(100), NULL): Soil classification name.
  * `ph_level` (DECIMAL(5,2), NULL): pH value.
  * `organic_matter_pct` (DECIMAL(5,2), NULL): Organic matter content percentage.
  * `suitability_score` (DECIMAL(5,2), NULL): Crop-suitability index.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 14. `land_images`
* **Operational Purpose:** Stores paths and metadata for satellite passes and uploaded images.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique image identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Image capture date.
  * `image_path` (VARCHAR(500), NOT NULL): Path to image on storage.
  * `image_type` (VARCHAR(100), NOT NULL): Category (e.g., `ndvi`, `true_color`).
  * `cv_analysis_summary` (JSON, NULL): OpenCV segment output logs.
  * `ndvi_mean` (DECIMAL(6,4), NULL): Mean calculated NDVI.
  * `cloud_cover_pct` (DECIMAL(5,2), NULL): Cloud cover percentage.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 15. `analytics_summaries`
* **Operational Purpose:** Caches AI-generated textual summaries and insights for registered lands.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique record identifier.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Summary compilation time.
  * `summary_text` (TEXT, NOT NULL): Narrative insights from LLM (Gemini).
  * `summary_payload` (JSON, NULL): Diagnostic metadata.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 16. `land_alerts`
* **Operational Purpose:** Logs agricultural warnings, temperature spikes, or moisture anomalies.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique alert log ID.
  * `land_id` (BIGINT, NOT NULL, FK -> `lands`): Bounded parcel.
  * `timestamp` (TIMESTAMP): Alert generation timestamp.
  * `alert_type` (VARCHAR(100), NOT NULL): Category of risk (e.g., `water_stress`, `heatwave`).
  * `severity` (VARCHAR(20), NOT NULL): Severity (`warning`, `info`, `critical`).
  * `message` (TEXT, NOT NULL): Description of alert.
  * `payload` (JSON, NULL): Diagnostic variables.
  * `resolved_at` (TIMESTAMP, NULL): Resolution timestamp.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.

### 17. `land_soil_profiles`
* **Operational Purpose:** Caches static soil metrics fetched from SoilGrids (ISRIC) upon parcel registration.
* **Attributes:**
  * `id` (BIGINT, PK, AUTO_INCREMENT): Unique soil profile ID.
  * `land_id` (BIGINT, NOT NULL, UNIQUE, FK -> `lands`): Bounded parcel.
  * `ph_h2o` (DECIMAL(5,2), NULL): pH value.
  * `soc_g_per_kg` (DECIMAL(8,3), NULL): Soil organic carbon (g/kg).
  * `clay_pct` (DECIMAL(6,2), NULL): Clay percentage.
  * `sand_pct` (DECIMAL(6,2), NULL): Sand percentage.
  * `silt_pct` (DECIMAL(6,2), NULL): Silt percentage.
  * `bulk_density` (DECIMAL(6,3), NULL): Soil density ($kg/dm^3$).
  * `nitrogen_g_per_kg` (DECIMAL(7,3), NULL): Total nitrogen ($g/kg$).
  * `cec_cmol` (DECIMAL(8,3), NULL): Cation Exchange Capacity.
  * `texture_class` (VARCHAR(32), NULL): Soil textural class name.
  * `depth_profile` (JSON, NULL): Depth-wise profile measurements JSON.
  * `suitability_score` (DECIMAL(5,2), NULL): Suitability score (0–100).
  * `fetched_at` (TIMESTAMP): Retrieval date.
  * `source_id` (BIGINT, NULL, FK -> `data_sources`): Telemetry connector source.
