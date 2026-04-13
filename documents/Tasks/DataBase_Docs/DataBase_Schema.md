# Database Schema

## Purpose

This document defines the MySQL schema for the database component. It separates the currently implemented schema from the approved target operational schema and locks down keys, granularity, staging, and lineage.

## Current State

The current schema implemented by [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql) is limited to environment bootstrap and a connectivity table.

### Current Databases

- `agriculture`
- `test_agriculture`

### Current Table: `test_connection`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | `INT` | `PRIMARY KEY`, `AUTO_INCREMENT` | Current implemented key |
| `status` | `VARCHAR(50)` | `NOT NULL` | Connectivity verification value |
| `initialized_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Insert timestamp |

Current limitations:

- No application domain tables exist yet.
- No foreign keys exist yet.
- No staging, batch, or error tables exist yet.
- No warehouse schema exists yet.

## Target State

The target operational schema is organized into reference tables, control tables, staging tables, and clean domain tables.

### Reference Tables

#### `crops`

| Column | Type | Constraints |
| --- | --- | --- |
| `crop_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `crop_name` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

#### `locations`

| Column | Type | Constraints |
| --- | --- | --- |
| `location_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `governorate` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` |
| `region` | `VARCHAR(100)` | `NULL` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

### Operational Control Tables

#### `ingestion_batches`

| Column | Type | Constraints |
| --- | --- | --- |
| `batch_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `source_system` | `VARCHAR(100)` | `NOT NULL` |
| `source_version` | `VARCHAR(100)` | `NULL` |
| `started_at` | `DATETIME` | `NOT NULL` |
| `completed_at` | `DATETIME` | `NULL` |
| `status` | `VARCHAR(50)` | `NOT NULL` |

Indexes:

- index on `source_system`
- index on `status`

#### `etl_errors`

| Column | Type | Constraints |
| --- | --- | --- |
| `etl_error_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `batch_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> ingestion_batches.batch_id` |
| `stage_name` | `VARCHAR(100)` | `NOT NULL` |
| `record_key` | `VARCHAR(255)` | `NULL` |
| `error_code` | `VARCHAR(100)` | `NOT NULL` |
| `error_message` | `TEXT` | `NOT NULL` |
| `is_retryable` | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

Indexes:

- index on `batch_id`
- index on `stage_name`

#### `users`

| Column | Type | Constraints |
| --- | --- | --- |
| `user_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` |
| `role` | `VARCHAR(50)` | `NOT NULL` |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

#### `images`

| Column | Type | Constraints |
| --- | --- | --- |
| `image_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `source` | `VARCHAR(100)` | `NOT NULL` |
| `path_raw` | `VARCHAR(500)` | `NOT NULL` |
| `path_processed` | `VARCHAR(500)` | `NULL` |
| `features_json` | `JSON` | `NULL` |
| `captured_at` | `DATETIME` | `NULL` |
| `processed_at` | `DATETIME` | `NULL` |
| `batch_id` | `BIGINT` | `NULL`, `FOREIGN KEY -> ingestion_batches.batch_id` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

### Staging Tables

#### `stg_crop_production_raw`

Raw one-to-one landing from source files for crop production.

#### `stg_water_usage_raw`

Raw one-to-one landing from source files for water datasets.

#### `stg_climate_records_raw`

Raw one-to-one landing from source files for climate datasets.

Required staging metadata columns for all `stg_*` tables:

- `staging_id` primary key
- `batch_id` foreign key to `ingestion_batches`
- `source_row_id` source row identity when available
- `payload_json` raw source payload
- `ingested_at` timestamp

### Clean Domain Tables

#### `crop_production`

Row granularity:

- Exactly one row per (`crop_id`, `location_id`, `year`, `batch_id`).

| Column | Type | Constraints |
| --- | --- | --- |
| `production_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `crop_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> crops.crop_id` |
| `location_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> locations.location_id` |
| `year` | `INT` | `NOT NULL`, `CHECK (year BETWEEN 1960 AND 2100)` |
| `area_feddan` | `DECIMAL(14,4)` | `NULL`, `CHECK (area_feddan >= 0)` |
| `area_hectare` | `DECIMAL(14,4)` | `NULL`, `CHECK (area_hectare >= 0)` |
| `production_tonnes` | `DECIMAL(14,4)` | `NOT NULL`, `CHECK (production_tonnes >= 0)` |
| `batch_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> ingestion_batches.batch_id` |
| `source_system` | `VARCHAR(100)` | `NOT NULL` |
| `ingestion_timestamp` | `DATETIME` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

Indexes and uniqueness:

- unique index on (`crop_id`, `location_id`, `year`, `batch_id`)
- index on (`year`, `location_id`)

#### `water_usage`

Row granularity:

- Exactly one row per (`crop_id`, `location_id`, `year`, `batch_id`).

| Column | Type | Constraints |
| --- | --- | --- |
| `water_usage_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `crop_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> crops.crop_id` |
| `location_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> locations.location_id` |
| `year` | `INT` | `NOT NULL`, `CHECK (year BETWEEN 1960 AND 2100)` |
| `water_need_m3_per_ha` | `DECIMAL(14,4)` | `NULL`, `CHECK (water_need_m3_per_ha >= 0)` |
| `water_per_ton_m3` | `DECIMAL(14,4)` | `NULL`, `CHECK (water_per_ton_m3 >= 0)` |
| `irrigation_type` | `VARCHAR(50)` | `NULL` |
| `batch_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> ingestion_batches.batch_id` |
| `source_system` | `VARCHAR(100)` | `NOT NULL` |
| `ingestion_timestamp` | `DATETIME` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

Indexes and uniqueness:

- unique index on (`crop_id`, `location_id`, `year`, `batch_id`)
- index on `irrigation_type`

#### `climate_records`

Row granularity:

- Exactly one row per (`location_id`, `year`, `batch_id`) at yearly aggregation level.

| Column | Type | Constraints |
| --- | --- | --- |
| `climate_record_id` | `BIGINT` | `PRIMARY KEY`, `AUTO_INCREMENT` |
| `location_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> locations.location_id` |
| `year` | `INT` | `NOT NULL`, `CHECK (year BETWEEN 1960 AND 2100)` |
| `temperature_mean` | `DECIMAL(10,4)` | `NULL` |
| `humidity_pct` | `DECIMAL(10,4)` | `NULL`, `CHECK (humidity_pct BETWEEN 0 AND 100)` |
| `batch_id` | `BIGINT` | `NOT NULL`, `FOREIGN KEY -> ingestion_batches.batch_id` |
| `source_system` | `VARCHAR(100)` | `NOT NULL` |
| `ingestion_timestamp` | `DATETIME` | `NOT NULL` |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` |

Indexes and uniqueness:

- unique index on (`location_id`, `year`, `batch_id`)
- index on (`year`, `location_id`)

## Join Contract

Approved analytical join strategy across clean operational tables:

- `crop_production` to `water_usage`: join on (`crop_id`, `location_id`, `year`, `batch_id`)
- `crop_production` to `climate_records`: join on (`location_id`, `year`, `batch_id`)
- `water_usage` to `climate_records`: join on (`location_id`, `year`, `batch_id`)

Reference joins:

- `crop_id -> crops.crop_id`
- `location_id -> locations.location_id`

## Derived Metric Ownership

- Canonical derived analytics metrics are owned by the warehouse layer.
- Operational tables store normalized input and source-linked metrics needed for API and ETL continuity.
- If a derived metric is materialized in operational tables for performance, it must include `batch_id`, `ingestion_timestamp`, and must be treated as non-canonical cache data.

## API to DB Mapping Boundary

Current implemented endpoints:

- `GET /api/health` reads no tables.
- `GET /api/health/db` executes connectivity query only.

Target boundary mapping:

- crop and production APIs read from `crop_production`, `crops`, `locations`
- water APIs read from `water_usage`, `crops`, `locations`
- climate APIs read from `climate_records`, `locations`
- ingestion and operations APIs write to `ingestion_batches`, `stg_*`, clean tables, and `etl_errors`
- image and CV metadata APIs read and write `images`

## Rules

- Current schema facts must reflect checked-in SQL only.
- Target tables are approved design targets, not implemented claims.
- No table may be added without a documented source or operational justification.
- No binary image payloads may be stored in MySQL.
- Clean domain tables must use surrogate IDs and foreign keys, not free-text joins.
- Every clean domain row must carry `batch_id` and `ingestion_timestamp`.
- Business logic remains in Python services and ETL, with constraints enforced at DB level for safety.

## Dependencies

- [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql)
- [services/backend/app/db/session.py](E:\Projects\Smart-Agriculture-Data-Platform\services\backend\app\db\session.py)
- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)

## Out of Scope

- Alembic migration implementation
- SQLAlchemy model code
- API endpoint payload design
