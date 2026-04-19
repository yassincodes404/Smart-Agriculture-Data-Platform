# Geospatial Structure Sync Contract

## 1. Purpose
This document is the canonical structure contract for keeping the geospatial implementation synchronized across:
- Backend module layout
- Data pipeline orchestration
- Database schema
- Docker runtime services and mounted paths

## 2. Canonical Geospatial Folder Layout
All geospatial implementation should follow this structure:

```text
services/backend/app/
├── api/
│   └── lands.py
├── lands/
│   ├── schemas.py
│   ├── service.py
│   └── repository.py
├── pipeline/
│   ├── land_discovery_pipeline.py
│   └── land_monitoring_pipeline.py
├── scheduler/
│   ├── jobs.py
│   └── runner.py
└── models/
    ├── land.py
    ├── data_source.py
    ├── land_climate.py
    ├── land_water.py
    ├── land_crop.py
    ├── land_soil.py
    ├── land_image.py
    └── analytics_summary.py
```

## 3. Backend to Pipeline to Database Sync Map
### 3.1 Land Discovery
- API trigger: `POST /api/v1/lands/discover`
- Backend orchestration: `services/backend/app/api/lands.py` + `services/backend/app/lands/service.py`
- Pipeline module: `services/backend/app/pipeline/land_discovery_pipeline.py`
- Database write targets:
  - `lands`
  - `land_images` (if image provided)
  - `land_climate` (initial snapshot record)
  - `data_sources`

### 3.2 Land Monitoring
- Scheduler trigger: `services/backend/app/scheduler/runner.py`
- Job entrypoint: `services/backend/app/scheduler/jobs.py`
- Pipeline module: `services/backend/app/pipeline/land_monitoring_pipeline.py`
- Database write targets:
  - `land_climate`
  - `analytics_summaries` (when AI summary stage is enabled)
  - `data_sources`

## 4. Database Contract
Schema source of truth for geospatial tables:
- `Database/geospatial_schema.sql`

Backend model registration source of truth:
- `services/backend/app/db/base.py`

The following table-model names must stay synchronized:
- `lands` <-> `Land`
- `data_sources` <-> `DataSource`
- `land_climate` <-> `LandClimate`
- `land_water` <-> `LandWater`
- `land_crops` <-> `LandCrop`
- `land_soil` <-> `LandSoil`
- `land_images` <-> `LandImage`
- `analytics_summaries` <-> `AnalyticsSummary`

## 5. Docker Runtime Contract
### Services
- `mysql`: Executes both bootstrap scripts:
  - `Database/init.sql`
  - `Database/geospatial_schema.sql`
- `backend`: Serves REST APIs and background task trigger endpoint(s)
- `scheduler`: Runs periodic monitoring cycle (`python -m app.scheduler.runner`)
- `opencv`: Dedicated CV environment
- `frontend`: User interface
- `nginx`: Gateway routing

### Shared Data Paths
- `./data:/data` must be mounted for both `backend` and `scheduler`.
- `./data/images:/images` remains mounted for `opencv`.

## 6. Naming Consistency Rule
Geospatial phase naming is canonical as:
- `02_Database_Schema.md` = Phase 1
- `03_Phase2_Discovery_Pipeline.md` = Phase 2
- `04_Phase3_Monitoring_Pipeline.md` = Phase 3

All documentation references must use these exact filenames.

## 7. ORM vs MySQL DDL (intentional drift)
- `Database/geospatial_schema.sql` uses `BIGINT` for geospatial primary and foreign keys (MySQL-friendly).
- SQLAlchemy models under `services/backend/app/models/` use `Integer` for the same columns so **SQLite-backed pytest** gets working `AUTOINCREMENT` semantics. Values stay within a shared 32-bit range in development and tests.
- Runtime MySQL accepts reads/writes for these columns interchangeably within that range.

## 8. Scheduler configuration
- `LAND_MONITOR_INTERVAL_MINUTES` in `.env.backend` (see `app/core/config.py`) controls the APScheduler interval in `agri_scheduler`.

## 9. General development rules
Layering, testing, Docker, and PR habits for humans and AI agents: `documents/Developer_and_AI_Continuation_Guide.md`.
