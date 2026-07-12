# Smart Agriculture Data Platform - Rebuild & Run (Windows PowerShell)
# Use this to return to / maintain the multi-container setup.
#
# Prerequisites:
# - Docker Desktop running (with WSL2 backend recommended)
# - .env.db and .env.backend present (they are)
#
# This builds and starts:
#   - postgres (Database/)
#   - backend + scheduler (services/backend)
#   - frontend (services/frontend/web - Vite dev)
#   - nginx (infra/nginx)
#
# After start:
#   Open http://localhost
#
# To test fixes:
#   1. Register a new land
#   2. Wait for it to become "active"
#   3. Open the land detail page -> NDVI charts should now appear (synthetic fallback if no Sentinel data)
#   4. Click Export -> should download .xlsx (requires xlsxwriter which is now in requirements)

Write-Host "=== Smart Agriculture - Multi-Container Rebuild ===" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# 1. Ensure we are in project root
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "`n[1/5] Validating docker compose file..." -ForegroundColor Yellow
docker compose config --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker-compose.yml is invalid!"
    exit 1
}
Write-Host "Compose file OK." -ForegroundColor Green

# 2. Bring down any old containers (optional clean)
Write-Host "`n[2/5] Stopping existing containers (if any)..." -ForegroundColor Yellow
docker compose down --remove-orphans | Out-Null

# 3. Build (no cache to pick up requirements changes etc.)
Write-Host "`n[3/5] Building images (no cache) - this can take 5-20+ minutes first time (geospatial libs are heavy)..." -ForegroundColor Yellow
Write-Host "Building backend, scheduler, frontend, nginx, postgres..." -ForegroundColor Gray
Write-Host "Note: Added gdal / proj packages for rioxarray etc. If build complains about gdal, we can adjust." -ForegroundColor DarkGray
Write-Host "IMPORTANT: Docker Desktop must be running before executing this script." -ForegroundColor Yellow

docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Check the output above."
    exit 1
}
Write-Host "Build succeeded." -ForegroundColor Green

# 4. Start in detached mode
Write-Host "`n[4/5] Starting multi-container stack..." -ForegroundColor Yellow
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose up failed."
    exit 1
}

Write-Host "`n[5/5] Stack is starting. Status:" -ForegroundColor Green
docker compose ps

Write-Host @"

✅ Multi-container system is up.

Next steps:
  - Visit: http://localhost   (or http://localhost:80)
  - Check logs if needed:
      docker compose logs -f backend
      docker compose logs -f scheduler
      docker compose logs -f frontend

  - Create a new land via the UI.
  - On the land detail page you should now see the NDVI Vegetation Index section
    (even for brand new lands).
  - The Export button should download an .xlsx file.

To stop:
  docker compose down

To rebuild only changed services:
  docker compose build --no-cache backend
  docker compose up -d --no-deps backend

"@ -ForegroundColor Cyan
