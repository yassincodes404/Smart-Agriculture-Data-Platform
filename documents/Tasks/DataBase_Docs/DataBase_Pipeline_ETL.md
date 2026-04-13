# Database Pipeline and ETL

## Purpose

This document defines the strict database-facing data flow from approved external sources to operational storage and the future warehouse.

## Current State

- The repository currently contains no implemented ETL modules that load approved source datasets into MySQL.
- The active stack uses direct FastAPI to MySQL access and a database health check only.
- Existing docs in other folders mention Celery and Redis, but the current README identifies those as removed from the active architecture.
- Therefore, current database documentation must treat Python ETL as the owner of transformation logic without claiming an active scheduler or queue.

## Target State

The approved data flow is:

`approved sources -> raw file storage -> staging tables -> validation and normalization -> clean operational tables -> warehouse -> analytics and API consumption`

### Stage 1: Source Acquisition

Allowed sources:

- FAOSTAT
- CAPMAS
- NASA Earthdata
- SMAP
- FEWS NET
- GADM
- Sentinel-2
- Google Earth Engine

Output:

- raw CSV files
- raw image files
- source metadata records where needed
- source version reference when available

### Stage 2: Raw Storage

Raw inputs are stored in the `data` layer before relational loading.

Intended directories:

- `data/csv/`
- `data/images/`
- `data/docs/`

Observed current repo state:

- `data/images/` exists today
- `data/csv/` and `data/docs/` are target storage paths described in project docs but are not currently present in the repo tree

### Stage 3: Batch Registration

Before loading any records, ETL creates one row in `ingestion_batches` with:

- `source_system`
- `source_version`
- `started_at`
- `status`

All downstream records must reference the created `batch_id`.

### Stage 4: Staging Load

Raw records are loaded to staging tables with minimal transformation:

- `stg_crop_production_raw`
- `stg_water_usage_raw`
- `stg_climate_records_raw`

Staging rows preserve source payload and source row identity to support:

- debugging
- replay
- data audits

### Stage 5: Python Validation and Normalization

Python ETL is responsible for:

- schema validation
- null handling
- duplicate detection
- unit normalization
- source tagging
- derived metric calculation

Python ETL must produce clean operational rows only after validation passes.

### Stage 6: Clean Operational Load

Validated records are loaded into target operational tables such as:

- `crop_production`
- `water_usage`
- `climate_records`
- `images`
- `tasks`
- `backups`

All rows in clean operational tables must include:

- `batch_id`
- `ingestion_timestamp`

### Stage 7: Warehouse Load

Validated operational data is transformed into the future star schema:

- `fact_agriculture`
- `dim_crop`
- `dim_location`
- `dim_time`
- `dim_climate`

### Stage 8: Consumption

Consumers of structured data:

- FastAPI backend
- analytics modules
- future dashboard and reporting layers

## Join Contract for ETL and Analytics

Approved join keys between clean operational tables:

- `crop_production` and `water_usage`: (`crop_id`, `location_id`, `year`, `batch_id`)
- `crop_production` and `climate_records`: (`location_id`, `year`, `batch_id`)
- `water_usage` and `climate_records`: (`location_id`, `year`, `batch_id`)

ETL must not join by free-text crop or governorate fields once IDs exist in clean tables.

## ETL Rules

- ETL may use only approved source systems.
- ETL must not create undocumented columns.
- ETL must preserve source lineage through source-system metadata.
- ETL must keep business and analytical logic in Python, not in frontend code or hidden DB procedures.
- Failed validations must stop clean-table load for the affected records.
- Images are handled as file assets; MySQL stores metadata and paths only.
- Clean tables must be loaded from staging, not directly from source files.

## Derived Metric Ownership Rule

- Canonical derived analytics metrics are owned by the warehouse layer.
- Operational DB stores source-linked normalized data and minimum derived fields needed for API continuity.
- If a derived metric is materialized in operational tables, it must be marked with `batch_id` and treated as non-canonical cache data.

## Error Handling and Retry Strategy

Validation and load failures are written to `etl_errors` with:

- `batch_id`
- `stage_name`
- `record_key`
- `error_code`
- `error_message`
- `is_retryable`

Retry policy:

- retryable failures are reprocessed by batch after source or logic correction
- non-retryable failures remain logged for audit and manual triage
- no failed record is silently dropped

## Current vs Future Execution

Current documented execution assumption:

- manual or directly-invoked Python processes are acceptable because no active queue or orchestration service is present in `docker-compose.yml`

Future optional execution design:

- scheduled orchestration may be added later, but it must be documented separately and must not rewrite current-state architecture sections

## Dependencies

- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)
- [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml)
- [documents/Tasks/DataBase_Docs/DataBase_Data_Definition.md](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs\DataBase_Data_Definition.md)
- [documents/Tasks/DataBase_Docs/DataBase_Schema.md](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs\DataBase_Schema.md)
- [documents/Tasks/DataBase_Docs/DataBase_Warehouse_Design.md](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs\DataBase_Warehouse_Design.md)

## Out of Scope

- Specific Python package or module names
- Queue or scheduler implementation
- ML model training flow beyond database handoff points
