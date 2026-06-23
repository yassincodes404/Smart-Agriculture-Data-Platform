# Smart Agriculture Data Platform

A scalable, containerized architecture for agricultural data processing, analysis, and visualization.

## 🏗️ Architecture & Project State

The project was recently restructured to provide a clean, microservices-oriented environment. Background jobs, task queues (Celery/Redis), and object storage references have been intentionally removed to streamline the platform around a lightweight REST API and direct database integration.

### Core Services

The platform consists of **6 Dockerized Containers** orchestrated via `docker-compose`:

1. **`agri_nginx`** (Reverse Proxy)
   - **Tech Stack**: NGINX
   - **Role**: Serves as the primary API Gateway and reverse proxy.
   - **Internal Routing**:
     - `/` -> Routes to the Frontend application.
     - `/api/` -> Routes to the FastAPI Backend.
   - **Exposed Port**: `80`

2. **`agri_frontend`** (Web Client)
   - **Tech Stack**: React + Vite + Node.js
   - **Role**: The main user interface for visualizing agricultural data. Vite ensures blazing fast hot-reload during development.
   - **Exposed Port**: `5173`

3. **`agri_backend`** (REST API)
   - **Tech Stack**: Python 3.11, FastAPI, Uvicorn, SQLAlchemy
   - **Role**: Core application logic, data querying, and REST endpoints.
   - **Exposed Port**: `8000`

4. **`agri_mysql`** (Relational Database)
   - **Tech Stack**: MySQL 8.0
   - **Role**: Primary data store for the application. Data is persistently stored in a Docker volume (`mysql_data`). Isolated within its own `Database/` directory to manage initialisation and schemas.
   - **Host Port Mapping**: `3307` (Mapped from internal `3306` to avoid conflicts with host databases)

5. **`agri_scheduler`** (Background Monitoring Scheduler)
   - **Tech Stack**: Python 3.11, APScheduler, SQLAlchemy
   - **Role**: Runs scheduled land-monitoring pipeline jobs and keeps geospatial time-series tables updated.
   - **Deployment Model**: Reuses the backend image with a scheduler entrypoint (`python -m app.scheduler.runner`).

6. **`agri_cv`** (Computer Vision Worker Environment)
   - **Tech Stack**: Python 3.11, OpenCV, Pillow, NumPy
   - **Role**: A standalone Python environment explicitly designed for heavy image processing tasks and computer vision algorithms. It mounts local image directories to operate on raw visual data.

---

## 📂 Project Structure

```text
Smart-Agriculture-Data-Platform/
│
├── .env.backend                 # Environment variables for FastAPI backend
├── .env.db                      # Environment variables for MySQL database
├── docker-compose.yml           # Multi-container orchestration config
│
├── data/                        # Persistent local data volumes
│   ├── csv/                     # Raw agricultural CSV datasets
│   ├── docs/                    # Related data documentation
│   └── images/                  # Images for OpenCV processing
│
├── infra/
│   ├── azure/                   # Deployment scripts & Azure configs
│   └── nginx/                   # NGINX configuration and Dockerfile
│       └── conf.d/default.conf  # Proxy routing configuration
│
├── services/
│   ├── backend/                 # FastAPI Source Code & Dockerfile
│   │   ├── requirements.txt     # Python dependencies
│   │   └── app/                 # Backend application modules
│   │       ├── api/             # API Router endpoints
│   │       ├── core/            # App configurations and constants
│   │       ├── models/          # SQLAlchemy Database Models
│   │       ├── db/              # Database connection bindings
│   │       ├── users/           # User authentication logic
│   │       ├── ai/              # AI predictive logic
│   │       ├── cv/              # Bridge to computer vision tasks
│   │       └── ...
│   │
│   ├── frontend/web/            # React + Vite Web Application
│   │
│   └── opencv/                  # Standalone OpenCV processing logic
│
├── Database/                    # Dedicated Database architecture
│   ├── Dockerfile               # MySQL 8 Custom Image mapping
│   ├── init.sql                 # Baseline table initialization script
│   ├── geospatial_schema.sql    # Land-centric schema bootstrap script
│   └── (migrations/seeds)       # Future room for Alembic or schema dumps
├── documents/                   # General platform documentation
└── release/                     # Production build artifacts
```

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

### Launching the Application

To build and start all containers in the background, run:

```bash
docker compose up -d --build --remove-orphans
```

### Accessing the Services
- **Web Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Nginx Gateway**: [http://localhost](http://localhost)

### Stopping Services
To shut down the platform:
```bash
docker compose down
```

## 🧠 Recent Updates
*   **Decoupled Architecture**: Removed Celery, Redis, and MinIO components. The platform is now completely stateless and data interactions are handled directly through FastAPI endpoints.
*   **Vite Integration**: React Frontend has been migrated from Webpack/CRA to Vite for significantly faster development builds.
*   **Timeout Resiliency**: Python dependencies are fetched with extended timeout parameters to reliably fetch heavy data science libraries like `pandas` and `scikit-learn`.
*   **Database Isolation**: Extracted MySQL initialization into its own container context under `Database/` allowing custom SQL seeding before mount.
*   **Geospatial Schema Sync**: Added a dedicated geospatial schema bootstrap script and synchronized backend model scaffolding for `Land`-centric tables.
*   **Scheduler in Docker**: Added a scheduler container that shares backend code and data volumes to run monitoring jobs in a Docker-native way.
*   **MySQL Authentication Fix**: Implemented the `cryptography` dependency in the backend to natively resolve MySQL 8's newer `caching_sha2_password` standard when making SQLAlchemy connections.
*   **Vite Hot-Reload in Docker**: Configured explicit filesystem polling in Vite and `docker-compose.yml` to ensure instantaneous HMR directly from Windows host down through the Linux container.
*   **Nginx Reverse Proxy & WebSocket**: Finalized Nginx gateway with clean `/api/` routing that preserves path configurations, as well as implemented active WebSocket proxying to support frontend Vite hot-reloading reliably.
