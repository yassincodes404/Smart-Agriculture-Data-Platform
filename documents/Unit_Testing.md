# Unit Testing — Smart Agriculture Data Platform

**Location:** `services/backend/`  
**Framework:** `pytest` + `httpx` (FastAPI TestClient)  
**Database:** SQLite in-memory — **MySQL is never touched during tests**

---

## Quick Start

> Run from inside `services/backend/` directory.

```powershell
# Run ALL tests
python -m pytest app/tests/ -v

# Run only API endpoint tests
python -m pytest app/tests/api/ -v

# Run a specific test file
python -m pytest app/tests/api/test_auth.py -v
python -m pytest app/tests/api/test_users.py -v
python -m pytest app/tests/api/test_health.py -v

# Run with short output (less verbose)
python -m pytest app/tests/api/ -q

# Run with coverage report
python -m pytest app/tests/api/ -v --tb=short
```

---

## Running Inside Docker

When the full Docker stack is running, execute tests inside the backend container:

```bash
# Run all tests inside the running container
docker compose exec backend python -m pytest app/tests/ -v

# Run only API tests
docker compose exec backend python -m pytest app/tests/api/ -v

# Run with PYTHONPATH explicitly (if import errors occur)
docker compose exec backend sh -c "PYTHONPATH=/app pytest app/tests/ -v"
```

---

## What Is Being Tested

### `test_health.py` — System Health Endpoints
Tests the two existing health check endpoints:

| Test | Endpoint | What it checks |
|---|---|---|
| `test_returns_200` | `GET /api/health` | HTTP 200 is returned |
| `test_response_body` | `GET /api/health` | Body is `{"status": "backend running"}` |
| `test_content_type_is_json` | `GET /api/health` | Response is JSON |
| `test_returns_200` | `GET /api/health/db` | HTTP 200 is returned |
| `test_status_field_present` | `GET /api/health/db` | Response has a `status` field |
| `test_database_is_reachable` | `GET /api/health/db` | DB check doesn't crash |

### `test_auth.py` — Authentication Endpoints
Tests all auth flows — 29 test cases:

| Test Group | Endpoint | Scenarios |
|---|---|---|
| `TestRegister` | `POST /api/v1/auth/register` | Success (201), duplicate email (400), invalid email (422), short password (422), bad role (422), missing fields (422) |
| `TestLogin` | `POST /api/v1/auth/login` | Success + token returned, wrong password (401), unknown email (401), bad format (422) |
| `TestMe` | `GET /api/v1/auth/me` | Valid token → user data, no token (401), invalid token (401), expired token (401), password not in response |
| `TestLogout` | `POST /api/v1/auth/logout` | Valid token → success, no token (401) |

### `test_users.py` — User Management Endpoints
Tests admin-only CRUD operations — 25 test cases:

| Test Group | Endpoint | Scenarios |
|---|---|---|
| `TestListUsers` | `GET /api/v1/users/` | Admin → 200, viewer → 403, analyst → 403, no token → 401, total count, no password leaks |
| `TestGetUser` | `GET /api/v1/users/{id}` | Admin → 200, 404 if missing, viewer → 403, no token → 401 |
| `TestUpdateUser` | `PUT /api/v1/users/{id}` | Change role, deactivate, change email, 404, duplicate email (400), viewer → 403, invalid role (422) |
| `TestDeleteUser` | `DELETE /api/v1/users/{id}` | Admin → 200, user gone after delete, 404 if missing, viewer → 403, no token → 401 |

---

## How Database Isolation Works

```
Tests                           Production
─────                           ──────────
SQLite in-memory (test.db)      MySQL (agriculture database)
Created fresh per test          Persistent Docker volume
Dropped after each test         Never touched by tests
No Docker required              Requires Docker stack
```

**Key mechanism:** The FastAPI `get_db()` dependency is overridden in every test to
return a SQLite session instead of the MySQL session. MySQL is **never contacted**.

```python
# conftest.py — what happens per test
app.dependency_overrides[get_db] = lambda: sqlite_session  # override
# ... test runs against SQLite ...
app.dependency_overrides.clear()  # restore original
```

---

## Expected Output

```
platform win32 -- Python 3.11.x
collected 60 items

app/tests/api/test_auth.py .............................   [ 48%]
app/tests/api/test_health.py ......                        [ 58%]
app/tests/api/test_users.py .........................      [100%]

================== 60 passed, 2 warnings in 81.27s ==================
```

---

## Adding New Tests

When adding a new API domain (e.g., `crops`, `water`), create:

```
services/backend/app/tests/api/test_crops.py
```

Use the same pattern:
```python
def test_something(client):   # client fixture from conftest.py
    response = client.get("/api/v1/crops/")
    assert response.status_code == 200
```

---

## Requirements

The following packages must be installed (already in `requirements.txt`):

```
pytest
pytest-asyncio
pytest-mock
httpx
fastapi[testclient]
sqlalchemy          ← for SQLite test engine
```

Install locally:
```powershell
pip install pytest pytest-asyncio httpx
```
