# Database Administration and Governance

## Purpose

This document defines the operational control rules for the database component so future engineers can manage schema, data quality, access, and change safely.

## Current State

- MySQL runs as a Dockerized service using environment variables from [.env.db](E:\Projects\Smart-Agriculture-Data-Platform\.env.db).
- The backend uses a direct SQLAlchemy connection string from [.env.backend](E:\Projects\Smart-Agriculture-Data-Platform\.env.backend).
- No implemented migration framework or backup automation is present in the checked-in repo.
- `.env.backend` still contains Redis and Celery variables, but these are treated as legacy residue because the active compose stack and README do not include those services.

## Target State

The database component should be governed through explicit rules for access, schema change, validation, backup, and performance.

### Access Control

- Separate root administration credentials from application credentials.
- The application should use least-privilege database access for routine reads and writes.
- Future admin tasks such as schema change or restore should require elevated credentials outside normal application runtime.

### Backup and Restore

- Backup processes must capture operational MySQL data on a defined schedule once operational tables exist.
- Backup metadata should be tracked in the `backups` table when implemented.
- Restore procedures must be tested against non-production data before use in production.
- Backup files must not be treated as schema documentation.

### Migration and Versioning

- Schema changes must be versioned through a documented migration process before implementation starts.
- Alembic is listed in backend dependencies and is the preferred migration tool if migrations are added.
- No table or column may be introduced without updating the database documentation package first.
- Current-state documentation must always distinguish implemented SQL from target design.
- Batch lineage is mandatory for clean operational datasets via `ingestion_batches` and `batch_id`.
- Source version tracking must be retained when available to support replay and rollback.

### Data Validation

- All loaded data must pass source-specific validation in Python ETL before relational persistence.
- Null handling rules must be explicit per column, not assumed.
- Numeric metrics such as area, production, temperature, humidity, and water usage must reject impossible negative values unless a source-specific exception is documented.
- Source lineage must be retained for operational domain tables.
- Row granularity constraints must be enforced via unique keys at table level.
- Domain constraints such as non-negative metrics and humidity range must be enforced as database checks where supported.

### ETL Error Governance

- All ETL failures must be recorded in `etl_errors`; no silent drops are allowed.
- Each error record must include `batch_id`, pipeline stage, record identity, and retryability flag.
- Retryable errors may be reprocessed by batch after correction.
- Non-retryable errors remain in error history for audit and triage.

### Performance and Indexing

- Primary keys are required on all persistent operational and warehouse tables.
- Composite indexes should support common filter patterns such as crop, governorate, and year.
- Indexes must be justified by query or load patterns; avoid speculative indexing.
- Analytical aggregation workloads belong in the future warehouse layer, not directly on raw operational loads where avoidable.

### Documentation Governance

- The 7 database documents in [documents/Tasks/DataBase_Docs](E:\Projects\Smart-Agriculture-Data-Platform\documents\Tasks\DataBase_Docs) are the control set for the database component.
- If a new source, table, field, or warehouse measure is proposed, the docs must be updated before implementation.
- Undocumented tables and fields are non-compliant.
- Current-state sections must be derived from repository truth, not inferred future intent.

## Rules

- No architecture drift: removed services such as Redis and Celery must not be described as active present-day database dependencies.
- No hidden logic: business rules and analytics logic belong in Python code and documented ETL.
- No undocumented source systems.
- No storing image binaries in MySQL.
- No production-like data handling assumptions without explicit documentation.

## Dependencies

- [.env.db](E:\Projects\Smart-Agriculture-Data-Platform\.env.db)
- [.env.backend](E:\Projects\Smart-Agriculture-Data-Platform\.env.backend)
- [README.md](E:\Projects\Smart-Agriculture-Data-Platform\README.md)
- [docker-compose.yml](E:\Projects\Smart-Agriculture-Data-Platform\docker-compose.yml)

## Out of Scope

- Production security hardening specifics
- Cloud secret management tooling
- CI/CD pipeline enforcement details
