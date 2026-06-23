# Backend Architecture

## Purpose
This document defines the backend structure for the Smart Agriculture Data Platform so developers know:
- where each responsibility belongs
- how request and data flows work
- which files already exist and which files still need to be created

## Scope
Backend only:
- `services/backend/app`
- `Database/init.sql`
- backend tests under `services/backend/app/tests`

## Architecture Style
Layered architecture with clear boundaries:

1. API layer: HTTP routing and input/output contracts.
2. Service layer: business rules and orchestration.
3. Repository layer: database queries only.
4. Data layer: SQLAlchemy models and MySQL.

Rule: request handling must follow `API -> service -> repository -> DB`.

## Domain Modules
Core backend domains:
- `users`
- `crops`
- `water`
- `climate`
- `ingestion`
- `analytics`
- `ai`
- `cv`
- `backup`
- `search`

Each domain should follow one internal pattern:
- `schemas.py`: Pydantic request/response models
- `service.py`: business logic
- `repository.py`: persistence logic

## Request/Response Flow
```text
Client -> api/*.py -> <domain>/service.py -> <domain>/repository.py -> db/session.py -> MySQL
Client <- api/*.py <- <domain>/service.py <- <domain>/repository.py <- db/session.py <- MySQL
```

## External Data Flow
```text
External sources or uploaded CSV/images
-> ingestion layer (parse, validate, normalize)
-> MySQL clean tables
-> analytics layer (aggregates/KPIs)
-> API endpoints
-> frontend/dashboard consumers
```

## Backend File Structure (Current + Required)
Legend:
- `[existing]`: already in repo
- `[create]`: should be added for the backend plan
- `[update]`: file exists but needs implementation updates

```text
services/backend/
├── Dockerfile [existing]
├── requirements.txt [existing]
└── app/
    ├── main.py [update]
    ├── api/
    │   ├── __init__.py [existing]
    │   ├── health.py [existing]
    │   ├── system.py [create]
    │   ├── auth.py [create]
    │   ├── users.py [create]
    │   ├── crops.py [create]
    │   ├── water.py [create]
    │   ├── climate.py [create]
    │   ├── analytics.py [create]
    │   ├── ingestion.py [create]
    │   ├── ai.py [create]
    │   ├── cv.py [create]
    │   ├── search.py [create]
    │   └── backup.py [create]
    ├── core/
    │   ├── __init__.py [existing]
    │   ├── config.py [create]
    │   ├── dependencies.py [create]
    │   └── security.py [create]
    ├── db/
    │   ├── __init__.py [existing]
    │   ├── session.py [existing]
    │   └── base.py [create]
    ├── models/
    │   ├── __init__.py [existing]
    │   ├── user.py [create]
    │   ├── crop.py [create]
    │   ├── location.py [create]
    │   ├── crop_production.py [create]
    │   ├── water_usage.py [create]
    │   ├── climate_record.py [create]
    │   ├── ingestion_batch.py [create]
    │   ├── etl_error.py [create]
    │   └── image.py [create]
    ├── users/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [update]
    │   ├── service.py [update]
    │   └── repository.py [update]
    ├── crops/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [update]
    │   ├── service.py [update]
    │   └── repository.py [update]
    ├── water/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [update]
    │   ├── service.py [update]
    │   └── repository.py [update]
    ├── climate/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [update]
    │   ├── service.py [update]
    │   └── repository.py [update]
    ├── ingestion/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   ├── repository.py [create]
    │   └── loaders.py [create]
    ├── analytics/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   └── repository.py [create]
    ├── ai/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   └── repository.py [create]
    ├── cv/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   └── repository.py [create]
    ├── search/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   └── repository.py [create]
    ├── backup/
    │   ├── __init__.py [existing]
    │   ├── schemas.py [create]
    │   ├── service.py [create]
    │   └── repository.py [create]
    └── tests/
        ├── __init__.py [existing]
        ├── conftest.py [existing]
        ├── api/
        │   ├── test_health.py [existing]
        │   ├── test_auth.py [create]
        │   ├── test_users.py [create]
        │   ├── test_crops.py [create]
        │   ├── test_water.py [create]
        │   ├── test_climate.py [create]
        │   ├── test_analytics.py [create]
        │   └── test_ingestion.py [create]
        ├── users/test_security.py [existing]
        ├── models/test_user.py [existing]
        └── ai/test_prediction.py [existing]
```

## Current Reality vs Target
- Current implemented API: `/api/health`, `/api/health/db`
- Current models/domain implementation: mostly placeholders
- Target: full `api/v1` modular backend using the folder map above

## Non-Goals for This Phase
Do not add architecture scope for:
- logging stack design
- caching strategy
- rate limiting
- monitoring platform
- advanced devops workflows
