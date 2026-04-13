# Database Storage Management

## Purpose

This document defines where database-related files and structured records live, how they are separated, and which storage rules apply to the database component.

## Current State

- MySQL persistent storage is mounted through the `mysql_data` Docker volume in [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml).
- Database bootstrap SQL lives under [Database](E:\Projects\Smart-Agriculture-Data-Platform\Database).
- The backend mounts the repository `data` folder at `/data` inside the backend container.
- The OpenCV service mounts `data/images/` at `/images`.
- In the checked-in repo tree, only `data/images/` currently exists.

## Target State

The approved storage structure for database-adjacent data is:

```text
data/
├── csv/
├── images/
└── docs/
```

### Storage Areas

#### `data/csv/`

Purpose:

- raw structured source files
- downloaded datasets
- import-ready CSV handoff files

Rules:

- keep files immutable once captured from source when possible
- store source version or acquisition date in file naming
- do not treat CSV files as the authoritative cleaned dataset after ETL

#### `data/images/`

Purpose:

- raw satellite imagery
- processed image outputs for CV workflows

Rules:

- image files remain file assets on disk
- relational DB stores metadata and path references only
- file paths recorded in DB must be stable and normalized

#### `data/docs/`

Purpose:

- source documentation or data dictionaries that support ingestion and validation

Rules:

- docs support traceability only
- docs are not a substitute for schema definitions in database documentation

#### MySQL Operational Storage

Purpose:

- relational operational records
- system support tables
- cleaned analytical source tables
- staging tables and ETL lineage tables

Rules:

- use MySQL for structured records, metadata, and queryable facts
- do not store large binary assets in MySQL
- keep raw source payloads in staging tables until batch validation and audit windows are complete

## Naming and Lifecycle Rules

- File names should identify source, subject, and acquisition period where available.
- Processed image file names should retain a link to the raw source identifier.
- Raw files should not be overwritten silently.
- Cleaned relational data should be regenerated through ETL rather than edited manually in storage folders.
- Deletion and retention policies must be documented before automated cleanup is introduced.
- Batch lineage must be retained so each clean record can be traced back to an ingestion batch and source version.

## Ownership Boundaries

- Raw file storage is owned by ingestion and ETL processes.
- Structured relational records are owned by the database schema and Python backend and ETL code.
- Image processing outputs are owned by the CV processing workflow, but only metadata crosses into the DB.

## Rules

- Storage paths documented here must be used consistently in future implementation.
- Current missing directories may be added later, but their absence today must not be hidden in docs.
- No database design may assume image blobs in MySQL.
- No undocumented storage location may become part of the data pipeline.

## Dependencies

- [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml)
- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)
- [infra/nginx/conf.d/default.conf](E:\Projects\Smart-Agriculture-Data-Platform\infra\nginx\conf.d\default.conf)

## Out of Scope

- Cloud object storage design
- Backup retention implementation
- Data archival tooling
