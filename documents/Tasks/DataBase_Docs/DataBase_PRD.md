# Database PRD

## Purpose

This document defines the database component of the Smart Agriculture Data Platform as a strict source of truth for scope, boundaries, and allowed data behavior.

The database component exists to store and serve structured agricultural data for backend APIs, analytics, and future warehouse reporting. It must stay aligned with the actual repository state and the approved target architecture.

## Current State

- The project runs MySQL 8.0 as the `agri_mysql` container from [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml).
- Database bootstrap is limited to [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql), which creates `agriculture`, `test_agriculture`, and `test_connection`.
- The backend connects directly to MySQL through SQLAlchemy in [services/backend/app/db/session.py](E:\Projects\Smart-Agriculture-Data-Platform\services\backend\app\db\session.py).
- The backend currently exposes only health endpoints, including a database connectivity check.
- There are no implemented domain models in [services/backend/app/models](E:\Projects\Smart-Agriculture-Data-Platform\services\backend\app\models).
- The repo README states that Celery, Redis, and MinIO were removed from the active architecture.

## Target State

The database component will support a controlled agriculture analytics platform for Egypt with these storage layers:

1. Raw data lake storage for source files.
2. Staging storage in MySQL for traceable raw-to-structured transitions.
3. Operational MySQL storage for structured application data.
4. A future analytical warehouse layer for star-schema reporting.

The database component will support only these domains:

- Agricultural production data
- Water usage data
- Climate data
- Satellite image metadata
- Geographic reference data
- System data for users, tasks, backups, and ingestion tracking

## Allowed Data Sources

Only these external sources are allowed:

- FAOSTAT
- CAPMAS
- NASA Earthdata
- SMAP
- FEWS NET
- GADM
- Sentinel-2
- Google Earth Engine

## Storage Boundaries

- Raw CSV and downloaded source files belong in the `data` storage layer, not inside relational tables as opaque blobs.
- Satellite and processed image files are stored on disk, not as binary blobs inside MySQL.
- MySQL stores structured records, metadata, and derived tables required by the backend and analytics layers.
- The future warehouse stores analytical dimensions and facts, not operational application state.

## Functional Requirements

- The database must support backend API reads and writes for structured datasets.
- The database must support validated agricultural, water, and climate records.
- The database must store image metadata and file paths for raw and processed imagery.
- The database must support derived analytical metrics produced in Python ETL.
- The database must support a future warehouse design for aggregated reporting and KPI workloads.
- The database must support staging tables for raw ingestion replay, audit, and debugging.
- The database must support batch-level lineage with `batch_id`, `source_version`, and ingestion timestamps.
- The database must support ETL error persistence through a dedicated error table.
- The database must enforce explicit row-level granularity for all clean operational tables.

## Non-Functional Requirements

- MySQL is the operational relational engine.
- Application logic and analytics logic live in Python, not inside complex database procedures.
- The design must remain modular enough for backend, ETL, and future analytics consumers.
- Database definitions must be explicit enough that engineers do not infer undocumented data domains.
- Join behavior between production, water, and climate datasets must be deterministic and documented.
- Key relationships must be stable through surrogate IDs rather than free-text joining.

## Interface Boundary Mapping

Current implemented mapping:

- `GET /api/health` -> no table read.
- `GET /api/health/db` -> connectivity query only.

Target mapping boundary:

- crop and production APIs -> `crop_production`, `crops`, `locations`
- water APIs -> `water_usage`, `crops`, `locations`
- climate APIs -> `climate_records`, `locations`
- ingestion APIs -> `ingestion_batches`, `stg_*`, clean tables, `etl_errors`
- image and CV metadata APIs -> `images`

## Rules

- No new data domains may be added without documentation updates.
- No new source systems may be added unless they are explicitly approved and documented.
- No table may be added unless it maps to a source dataset, operational need, or derived analytical output.
- Images must be stored as file paths and metadata only.
- The current implementation state and the target design state must always be labeled separately.
- Redis and Celery must not be described as active runtime database dependencies in current-state sections.
- Clean operational records must carry source lineage fields and batch identity.
- Staging, clean, and warehouse responsibilities must remain separate and explicit.

## Dependencies

- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)
- [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml)
- [Database/init.sql](E:\Projects\Smart-Agriculture-Data-Platform\Database\init.sql)
- [services/backend/app/db/session.py](E:\Projects\Smart-Agriculture-Data-Platform\services\backend\app\db\session.py)
- [services/backend/app/main.py](E:\Projects\Smart-Agriculture-Data-Platform\services\backend\app\main.py)

## Out of Scope

- Frontend UI behavior
- Detailed backend API contract design
- ML model internals
- Computer vision algorithm implementation
- Infrastructure deployment beyond the database component boundary
