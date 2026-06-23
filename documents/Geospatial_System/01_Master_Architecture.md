# Master Architecture: Geospatial Intelligence System

## 1. System Vision
The core entity of the Smart Agriculture Data Platform is shifting from raw datasets to a **Land-Centric (Location-Driven)** model. 
The system operates as a **Location → Data Intelligence Engine → Historical Tracking System**.

## 2. Documentation Index (canonical filenames)
| Phase / topic | File |
|---------------|------|
| Structure sync (backend, pipeline, DB, Docker) | `05_Project_Structure_Sync.md` |
| Phase 1 — database | `02_Database_Schema.md` |
| Phase 2 — discovery | `03_Phase2_Discovery_Pipeline.md` |
| Phase 3 — monitoring | `04_Phase3_Monitoring_Pipeline.md` |

All cross-references must use these exact names (there is no separate `03_Phase1_*` / `04_Phase2_*` pair).

## 3. Current Project State Alignment
Based on the existing repository structure:
- **API Engine**: FastAPI (`services/backend/app/api`)
- **Database**: Relational MySQL 8.0 (`agri_mysql` and `services/backend/app/models`)
- **Computer Vision**: Dedicated OpenCV environment (`services/opencv` / `agri_cv`)
- **Background Workers**: **CRITICAL NOTE:** The `README.md` states that Celery/Redis were previously removed to simplify the architecture. *To support the Async trigger and Data Connectors required for this system, we MUST either re-introduce Celery/Redis OR implement `FastAPI BackgroundTasks` alongside a lightweight scheduler like `APScheduler`.* 

## 4. Core System Events
The system is built around two primary events processed through decoupled pipelines:

### Event 1: Land Discovery (Onboarding)
- **Trigger**: User inputs a GPS location (lat, long) and an optional image.
- **Action**: Immediately persists the `Land` record, then triggers a background pipeline to harvest, validate, and normalize geospatial, climate, water, and soil data for the exact coordinates.
- **Details**: See `03_Phase2_Discovery_Pipeline.md`

### Event 2: Land Monitoring (Continuous Tracking)
- **Trigger**: Scheduled cron job (e.g., Celery Beat or APScheduler).
- **Action**: Periodically updates the modular data tables (appending, not overwriting) and runs AI summaries over the time-series data to detect changes (e.g., crop yield trends, water efficiency).
- **Details**: See `04_Phase3_Monitoring_Pipeline.md`

## 5. Phased Execution Roadmap
1. **Phase 0: Infrastructure Prep** — Async execution path for pipelines: `FastAPI.BackgroundTasks` for on-demand discovery, Docker `scheduler` service + `APScheduler` for monitoring (see `05_Project_Structure_Sync.md` §5–6). Celery/Redis remain optional if workloads outgrow this model.
2. **Phase 1: Database Redesign** — `Land` entity and modular relational tables (`02_Database_Schema.md`, `Database/geospatial_schema.sql`).
3. **Phase 2: Discovery Pipeline** — API trigger and connector/CV ingestion (`03_Phase2_Discovery_Pipeline.md`).
4. **Phase 3: Monitoring & Analytics** — Scheduler jobs, time-series APIs, AI summaries (`04_Phase3_Monitoring_Pipeline.md`).
