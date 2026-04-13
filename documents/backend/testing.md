# Backend Testing Strategy

## Purpose
Defines the minimum testing rules required for backend delivery quality.

## Test Scope
Backend tests live under:
- `services/backend/app/tests`

Required test levels:
1. API tests (endpoint behavior)
2. Service tests (business logic)
3. Repository tests (DB queries and persistence)
4. Ingestion/analytics tests (data flow correctness)

## Required Test Structure
```text
services/backend/app/tests/
├── conftest.py
├── api/
│   ├── test_health.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_crops.py
│   ├── test_water.py
│   ├── test_climate.py
│   ├── test_analytics.py
│   └── test_ingestion.py
├── users/test_security.py
├── models/test_user.py
└── ai/test_prediction.py
```

## Minimum Test Cases Per Endpoint Group

### API Endpoint Tests
For each endpoint:
- success case
- validation failure case
- auth failure case (if protected)
- not found case (for entity endpoints)

### Service Tests
- business rule pass/fail
- edge cases and invalid transitions

### Repository Tests
- create/read/update/delete behavior (as relevant)
- filters and joins return expected rows

### Ingestion and Analytics Tests
- ingestion creates batch and loads rows
- invalid records are logged in `etl_errors`
- analytics aggregates expected metrics from clean tables

## Test Data and Isolation Rules
- Use `test_agriculture` only for tests.
- Do not run tests against production DB.
- Keep tests isolated per function where possible.
- Mock external services (AI, CV, third-party APIs).

## Existing Test Baseline
Current repo already contains:
- `conftest.py`
- `api/test_health.py`
- placeholder tests in `ai`, `models`, and `users`

These should be expanded from placeholders into real assertions.

## Execution Commands
Local:
```bash
pytest -v services/backend/app/tests
```

Docker:
```bash
docker compose exec backend pytest -v app/tests
```

## Quality Gate (Minimum)
- All API tests pass.
- No placeholder `pass` tests in critical modules (`api`, `service`, `repository`, `ingestion`, `analytics`).
- Health and DB connectivity tests remain green.

## Non-Goals for This Phase
- performance/load testing framework
- end-to-end browser tests
- advanced observability-driven testing
