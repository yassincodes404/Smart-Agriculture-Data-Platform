# Backend Data Flow

## Purpose
Explains the two essential backend flows:
- runtime API request flow
- ingestion and analytics pipeline flow

## 1) Runtime API Request Flow
This flow serves frontend and external consumers in real time.

```text
Client
-> /api/v1 endpoint
-> app/api/<domain>.py
-> app/<domain>/service.py
-> app/<domain>/repository.py
-> app/db/session.py
-> MySQL
-> response back through the same chain
```

## 2) Ingestion to Analytics Flow
This flow moves source data into API-ready analytical data.

```text
Approved source data (CSV/API/manual upload)
-> raw file storage (data/csv, data/images)
-> ingestion batch registration (ingestion_batches)
-> staging/validation/normalization in backend ingestion layer
-> clean operational tables (crop_production, water_usage, climate_records, images)
-> analytics aggregation in backend analytics layer
-> /api/v1/analytics and domain read endpoints
```

## Source Types
- agricultural production datasets
- water usage datasets
- climate datasets
- uploaded CSV/image files

## Clean Table Join Contract
- `crop_production` <-> `water_usage` on (`crop_id`, `location_id`, `year`, `batch_id`)
- `crop_production` <-> `climate_records` on (`location_id`, `year`, `batch_id`)
- `water_usage` <-> `climate_records` on (`location_id`, `year`, `batch_id`)

## Error Flow
When ingestion/validation fails:
1. write failure to `etl_errors`
2. keep batch status in `ingestion_batches`
3. do not silently drop records

## Output Ownership
- clean operational tables: backend ingestion layer
- KPI/aggregated outputs: backend analytics layer
- API payloads: backend API layer

## Boundary Rules
- API layer does not ingest files directly into domain tables.
- Ingestion layer does not expose direct HTTP responses.
- Analytics layer reads clean tables only, not raw files.

## Current State Note
- Current code exposes only health endpoints and DB connectivity.
- The data flow above is the required implementation target for backend delivery.

## Non-Goals for This Phase
- logging and observability pipeline details
- caching and rate-limit flow
- advanced orchestration stack design
