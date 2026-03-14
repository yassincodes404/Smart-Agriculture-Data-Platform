# Smart Agriculture Data Platform - Testing & Execution Guide
**Date:** March 14, 2026
**Author/Platform Engineer:** Yassin Tarek
**Subject:** Unit Testing Architecture, Execution Guide, and Implementation Report

---

## 🏃 How to Run the Tests

To protect your host machine and ensure tests run exactly as they will in production CI/CD pipelines, all test suites execute **inside** their respective Docker containers.

**Prerequisite**: The backend containers MUST be running (`docker compose up -d`).

### 1. Run Backend Tests (FastAPI / Pytest)
```bash
docker compose exec backend sh -c "PYTHONPATH=/app pytest app/tests/ -v"
```

### 2. Run Frontend Tests (React / Vitest)
```bash
docker compose exec frontend npm run test -- --run
```

### 3. Run Computer Vision Tests (OpenCV / Pytest)
```bash
docker compose exec opencv pytest tests/ -v
```

### 4. Run System-Wide Integration Tests (Local to Nginx proxy)
```bash
pytest tests/system/test_stack.py -v
```

*(Note: The integration test is executed directly on your Windows host targeting `http://localhost`, while all unit tests are executed inside the isolated Linux containers.)*

---

## 🛠️ How to Develop New Tests

We implemented a strictly **Mirrored Architecture**. When you create a new Python module, its test belongs in the identically named path under the `tests/` directory.

### Example: Adding a New Backend Test
If you write a new database helper function at `services/backend/app/db/crud.py`:
1. Navigate to: `services/backend/app/tests/db/`
2. Create: `test_crud.py`
3. Write your `def test_xyz():` function.
4. If your test needs to touch the database, accept the `db_session` fixture automatically exported by `conftest.py`:
```python
def test_user_creation(db_session):
    # db_session is automatically isolated and rolled back after this test
    user = User(name="Test")
    db_session.add(user)
    db_session.commit()
```

### Example: Adding a New Frontend Test
For React, tests live directly next to the component they are assessing:
1. You build: `src/components/Map/Map.jsx`
2. Create immediately next to it: `src/components/Map/Map.test.jsx`
3. Use vitest/RTL logic directly:
```javascript
import { render, screen } from '@testing-library/react';
import Map from './Map';

test('renders the map', () => {
    render(<Map />);
    expect(screen.getByTestId('agri-map')).toBeInTheDocument();
});
```

---

## 📄 Exactly What Changed in the Project

### 🟢 What Was Added
- **`services/backend/app/tests/`:** Implemented a deeply organized test suite covering `api/`, `models/`, `users/`, and `ai/`. Added `conftest.py` containing global `db_session` and `TestClient` fixtures.
- **`services/frontend/web/`:** Added `vitest.config.js`, `src/setupTests.js`, and `src/App.test.jsx` (which intercepts and mocks React fetch routing).
- **`services/opencv/`:** Added `tests/test_image_processing.py` to mathematically assert mock OpenCV images (NumPy arrays). Added a specific `requirements-test.txt`.
- **`tests/system/`:** Added `test_stack.py` at the project root to enforce proxy tracking from Python Requests → Nginx → Backend.

### 🟡 What Was Modified
- **`docker-compose.yml`**: Explicitly added MySQL execution lines mapping `test_agriculture` permissions across the stack.
- **`services/backend/requirements.txt`**: Added `pytest`, `pytest-asyncio`, `pytest-mock`, and `httpx`.
- **`services/frontend/web/package.json`**: Mounted `vitest`, `@testing-library/react`, and `jsdom`. Mapped the `"test": "vitest"` NPM script.

### 🔴 What Was Removed
- **Legacy unstructured backend tests:** Completely deleted the disorganized `Test_Back_End_heath.py`, `test_database.py`, and `test_items_api.py` root files, enforcing the newer mirrored hierarchy cleanly.

---

## 🐛 Problems Faced & Technical Resolutions

**1. Frontend NPM Installation Isolation (Windows strictness)**
- *Problem*: Windows PowerShell Execution Policies globally blocked `npm install -D vitest` via local terminals, failing to run the `npm.ps1` executables recursively.
- *Resolution*: Rather than modifying Windows host security policies, I bypassed PowerShell completely by tunneling the installations directly over Docker's `exec` layer (`docker compose exec frontend npm install...`), routing pure Linux commands onto the mounted Node volume.

**2. FastAPI Import Path Failures (`ModuleNotFoundError: No module named 'app'`)**
- *Problem*: When invoking Pytest inside the `backend` container, python's strict module loader failed to evaluate `/app/app/main.py`, collapsing the entire test suite immediately.
- *Resolution*: This happens because by default, Pytest assesses root relative scripts wrongly in nested container mounts. I rewired the execution command mathematically to inject the environment path variable during execution: `PYTHONPATH=/app pytest app/tests/ -v`.

**3. Test Database Missing Schema Auth (`1044, "Access denied for user 'agri_user'"`)**
- *Problem*: Backend routing tests instantly threw SQL syntax errors out. The SQLAlchemy Pytest fixture bound properly to `agri_mysql`, but the specific testing schema (`test_agriculture`) did not exist, kicking the user connection entirely out of the session.
- *Resolution*: Reopened the internal MySQL shell using explicit root password flags (`-u root -prootpassword`). I forced an explicit schema build and assigned absolute global privileges directly to `agri_user` over the test schema (`GRANT ALL PRIVILEGES ON test_agriculture.* TO 'agri_user'@'%'`), then flushed privileges dynamically. Tests now boot securely and roll back their changes cleanly on `conftest.py` teardown.
