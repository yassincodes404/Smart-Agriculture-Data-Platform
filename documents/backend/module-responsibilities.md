# Backend Module Responsibilities

## Purpose
Defines exactly what each backend module is allowed to do, so the team can work in parallel without mixing concerns.

## Core Rule
Use this flow for every feature:
`api -> service -> repository -> db/models`

## Folder Responsibilities

### `app/api/`
- Owns HTTP endpoints and routing.
- Parses request params/body and maps service outputs to API responses.
- Must not execute direct DB queries.

Expected files:
- `system.py`, `auth.py`, `users.py`, `crops.py`, `water.py`, `climate.py`, `analytics.py`, `ingestion.py`, `ai.py`, `cv.py`, `search.py`, `backup.py`

### `app/<domain>/service.py`
- Owns business rules and orchestration.
- Calls repositories and composes domain logic.
- Must not define HTTP routes.

### `app/<domain>/repository.py`
- Owns SQLAlchemy queries and persistence operations.
- Returns domain entities/data shapes to service layer.
- Must not contain HTTP concerns.

### `app/<domain>/schemas.py`
- Pydantic input/output contracts for each domain.
- Shared by API and service layers.

### `app/models/`
- SQLAlchemy table definitions only.
- Owns columns, keys, constraints, relationships.
- Must not contain endpoint logic.

### `app/db/`
- Database session/engine/base setup.
- Transaction/session utilities.
- Must stay generic and reusable.

### `app/core/`
- Cross-cutting backend configuration.
- `config.py`: settings and env loading
- `dependencies.py`: FastAPI dependencies
- `security.py`: password hashing and JWT helpers

### `app/ingestion/`
- Input pipeline logic for CSV/API data.
- Validates and writes batch-controlled records into operational tables.

### `app/analytics/`
- Aggregation and KPI logic on clean operational tables.
- No raw source file parsing.

### `app/tests/`
- API, service, repository, and integration tests.
- Mirrors runtime module ownership.

## Domain Template (Required)
Each business domain must keep this structure:
```text
<domain>/
├── __init__.py
├── schemas.py
├── service.py
└── repository.py
```

Required domains now:
- `users`
- `crops`
- `water`
- `climate`
- `ingestion`
- `analytics`
- `ai`
- `cv`
- `search`
- `backup`

## Practical Do/Do Not Rules

Do:
- keep API handlers thin
- keep validation/business rules in service
- keep SQL in repository
- keep table definitions in models

Do not:
- run SQL from `api/*.py`
- put business rules in `repository.py`
- duplicate schemas across modules
- put pipeline logic in API layer

## Ownership Mapping for Team Parallel Work
- API engineer: `app/api/*`
- domain engineer: `app/<domain>/{schemas.py,service.py,repository.py}`
- data engineer: `app/ingestion/*`, `app/analytics/*`, `app/models/*`
- platform engineer: `app/core/*`, `app/db/*`
- qa engineer: `app/tests/*`
