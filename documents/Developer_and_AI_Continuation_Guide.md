# Developer & AI Continuation Guide

This document is the **operating contract** for anyone (human or AI) extending the Smart Agriculture Data Platform. Follow it to keep behavior predictable, tests green, and Docker/MySQL/SQLite paths coherent.

---

## 1. Architecture pattern (do not break)

The backend uses a **layered flow** everywhere:

```text
api/<domain>.py   →  HTTP, status codes, Depends(get_db), auth guards
<domain>/service.py   →  business rules, orchestration (no raw SQL here)
<domain>/repository.py   →  SQLAlchemy queries only
models/<entity>.py   →  tables mapped to MySQL DDL / geospatial_schema.sql
```

**Rules**

- **Routers stay thin**: validate input, call `service`, map exceptions to HTTP.
- **Services** call **repositories** and other services; they do not embed SQL unless there is no repository yet (then add a repository first).
- **Repositories** only touch the ORM and return models or plain DTOs/dicts.
- **Long-running or post-response work** uses `BackgroundTasks` or the **`agri_scheduler`** process (`app.scheduler.runner`), not blocking inside the request except for quick work.
- **External HTTP** lives in small modules (e.g. `app/connectors/`), not inside API routes.

---

## 2. Database & models

- **MySQL source of truth for production schema** is under `Database/` (e.g. `geospatial_schema.sql` mounted in `docker-compose.yml`). Keep DDL and ORM column names aligned.
- **Register every new model** in `services/backend/app/db/base.py` so `Base.metadata.create_all` and tests see the table.
- **Geospatial tables** (`lands`, `land_climate`, …) are documented in `documents/Geospatial_System/02_Database_Schema.md` and `05_Project_Structure_Sync.md`.
- **ORM vs DDL integer widths**: SQL may use `BIGINT`; models may use `Integer` for SQLite/pytest autoincrement. See `05_Project_Structure_Sync.md` §7 before “fixing” a perceived mismatch.

---

## 3. Tests (mandatory habits)

- **Run** `pytest` from `services/backend` before pushing:  
  `python -m pytest app/tests/ -q`
- **Tests use in-memory SQLite** via `DATABASE_URL=sqlite://` in `app/tests/conftest.py`, with **`get_engine()`** as the single engine so **BackgroundTasks** share the same DB as the test client.
- **Do not** hardcode a second engine for “real” code paths used after the response; use `SessionLocal()` / `get_engine()` so test and production stay aligned.
- New features need **at least one API or service/repository test**; mock outbound HTTP (e.g. `unittest.mock.patch`) so CI does not depend on the public internet.

---

## 4. Docker & configuration

- **Backend and scheduler** share the backend image; scheduler command: `python -m app.scheduler.runner`.
- **Env**: `.env.backend` → read through `app/core/config.py` (`settings`); avoid scattered `os.getenv` in new code unless it is low-level session URL construction (see `db/session.py`).
- **Volumes**: `data/` is shared between backend and scheduler; `data/images/` for OpenCV — keep paths documented when adding file outputs.

---

## 5. API versioning & auth

- **Public REST** lives under **`/api/v1`** (routers included with that prefix in `main.py`).
- **Optional auth** for endpoints that work anonymously but enrich data when logged in: use `get_current_user_optional` in `dependencies.py`, not hacks in the router.
- **Breaking changes**: prefer additive fields and new endpoints; if you must break, document and version (e.g. `/api/v2` later).

---

## 6. Geospatial roadmap alignment

- **Phase 2 (discovery)**: persist `Land`, run async pipeline, append `land_*` rows, set `lands.status`.
- **Phase 3 (monitoring)**: scheduler → `land_monitoring_pipeline` → append time-series, summaries later.
- **Doc index**: `documents/Geospatial_System/01_Master_Architecture.md` and `05_Project_Structure_Sync.md`.

When adding a connector (climate, water, …): **get_or_create `data_sources`**, insert rows with **`source_id`**, keep units consistent (e.g. °C, mm).

---

## 7. Scaling & safety (practical)

- **Idempotency**: discovery/monitoring jobs should tolerate retries (unique constraints or upsert patterns where applicable).
- **Timeouts**: all external `httpx`/`requests` calls use explicit timeouts.
- **Secrets**: never commit API keys; use env vars and `.gitignore` for local env files.
- **Logging**: use `logging.getLogger(__name__)` in pipelines and connectors; avoid `print` in server code.

---

## 8. What not to do

- No drive-by renames or unrelated formatting across large files.
- Do not bypass `get_db()` in routes for “quick” DB access.
- Do not add Celery/Redis until workload clearly exceeds BackgroundTasks + APScheduler (document the decision in geospatial docs if you add them).

---

## 9. Quick checklist before a PR

1. `pytest app/tests/` passes.  
2. New models in `db/base.py`.  
3. DDL updated if production schema changes.  
4. Docker still builds (`backend`, `scheduler`, `mysql`).  
5. Geospatial docs updated if behavior or paths changed.

This guide is authoritative for day-to-day extension work unless a task explicitly overrides it.
