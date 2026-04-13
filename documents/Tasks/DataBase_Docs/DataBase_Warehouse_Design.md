# Database Warehouse Design

## Purpose

This document defines the future analytical warehouse design for agriculture reporting. It is planned architecture and is not implemented in the current repository.

## Current State

- No warehouse schema exists in checked-in SQL.
- No fact or dimension tables exist in [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql).
- No ETL code currently loads warehouse tables in the repository.

## Target State

The platform will use a star schema for analytical workloads and dashboards.

### Fact Table

#### `fact_agriculture`

| Column | Type | Meaning |
| --- | --- | --- |
| `fact_id` | bigint | Surrogate key |
| `crop_key` | bigint | Foreign key to `dim_crop` |
| `location_key` | bigint | Foreign key to `dim_location` |
| `time_key` | bigint | Foreign key to `dim_time` |
| `climate_key` | bigint | Foreign key to `dim_climate` |
| `batch_id` | bigint | Ingestion batch lineage from operational load |
| `production_tonnes` | decimal | Production volume |
| `area_hectare` | decimal | Cultivated area |
| `water_used` | decimal | Water usage at fact grain |
| `yield_per_hectare` | decimal | Derived yield metric |

Grain:

- One record per crop, location, and time period, with the applicable climate dimension context.

### Dimension Tables

#### `dim_crop`

| Column | Type | Meaning |
| --- | --- | --- |
| `crop_key` | bigint | Surrogate key |
| `crop_name` | string | Standardized crop name |

#### `dim_location`

| Column | Type | Meaning |
| --- | --- | --- |
| `location_key` | bigint | Surrogate key |
| `governorate` | string | Governorate name |
| `region` | string | Region grouping if defined |

#### `dim_time`

| Column | Type | Meaning |
| --- | --- | --- |
| `time_key` | bigint | Surrogate key |
| `year` | integer | Reporting year |
| `season` | string | Season if available and approved |

#### `dim_climate`

| Column | Type | Meaning |
| --- | --- | --- |
| `climate_key` | bigint | Surrogate key |
| `temperature` | decimal | Standardized temperature value |
| `humidity` | decimal | Standardized humidity value |

## Data Mapping

Operational to warehouse mapping will follow this pattern:

- `crop_production.crop_id` -> `dim_crop.crop_key` via crop reference mapping
- `crop_production.location_id` -> `dim_location.location_key` via location reference mapping
- `crop_production.year` -> `dim_time.year`
- climate measures from `climate_records` -> `dim_climate`
- production, area, water, and yield metrics -> `fact_agriculture`

## Warehouse Load Rules

- Warehouse data is loaded only from validated operational data and approved derived metrics.
- Surrogate keys are created in warehouse dimensions, not reused from operational natural keys.
- Derived measures such as `yield_per_hectare` and `water_used` must be calculated in Python ETL before warehouse load or in a documented load step.
- `season` is optional and may remain null or omitted until a source-backed definition exists.
- `batch_id` must be preserved in fact loads for audit and rollback traceability.
- Warehouse is the canonical store for derived analytics metrics.

## Why Star Schema

The warehouse is required because the platform is expected to support:

- dashboard aggregations
- KPI reporting
- trend analysis
- ranking and comparison workloads

This design keeps operational writes separate from analytical queries.

## Rules

- This warehouse design is planned and must not be described as implemented today.
- No dimension may be added without a documented mapping from approved source or derived data.
- No fact measure may be added without a documented calculation rule.
- Warehouse tables must not become the source of truth for raw ingestion.

## Dependencies

- [documents/Tasks/DataBase_Docs/DataBase_Data_Definition.md](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs\DataBase_Data_Definition.md)
- [documents/Tasks/DataBase_Docs/DataBase_Schema.md](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs\DataBase_Schema.md)
- Approved database target constraints

## Out of Scope

- Warehouse engine selection beyond the documented star schema
- BI tool configuration
- Materialized view strategy
