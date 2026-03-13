# 🌾 Smart Agriculture Data Platform

Containerised pipeline for ingesting and analysing agricultural geospatial data from multiple sources (Google Earth Engine, NASA AppEEARS, Copernicus ERA5, SMAP).

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **ingestion** | Python 3.11 (custom) | — | Data ingestion pipeline |
| **jupyter** | jupyter/scipy-notebook | `8888` | Interactive analysis |

## Quick Start

```bash
cp .env.example .env      # fill in credentials if needed
docker compose up -d --build
```

**Jupyter Lab** → [http://localhost:8888](http://localhost:8888)  
Token: `docker logs agri-jupyter`

## Project Structure

```
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── data/               # shared data
├── notebooks/          # Jupyter notebooks
└── src/ingestion/      # Python ingestion code
```

## Useful Commands

```bash
docker compose logs -f ingestion     # view ingestion logs
docker compose build ingestion       # rebuild after code changes
docker compose down                  # stop all
```

## License

See [LICENSE](./LICENSE).
