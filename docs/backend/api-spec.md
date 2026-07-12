# Backend API Specification

## Purpose
Defines the backend API contract so frontend and backend teams build against the same request/response rules.

## Base Path
- Canonical API base path: `/api/v1`
- Current implemented health endpoints in code: `/api/health`, `/api/health/db`
- Migration rule: keep health endpoints temporarily, but all new endpoints must be under `/api/v1`

## Standard Response Format

Success:
```json
{
  "status": "success",
  "data": {},
  "message": null,
  "meta": {}
}
```

Error:
```json
{
  "status": "error",
  "message": "Validation error",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {}
  },
  "meta": {}
}
```

## Error Contract
Common HTTP status codes:
- `400` bad request
- `401` unauthorized
- `403` forbidden
- `404` not found
- `409` conflict
- `422` validation error
- `500` internal server error

## Essential Endpoint Set

### System
- `GET /api/v1/system/health`
- `GET /api/v1/system/db`

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Users
- `GET /api/v1/users`
- `GET /api/v1/users/{user_id}`
- `PATCH /api/v1/users/{user_id}`
- `DELETE /api/v1/users/{user_id}`

### Crops
- `GET /api/v1/crops`
- `GET /api/v1/crops/production`

Query params:
- `year`
- `governorate`
- `crop`
- `page`
- `limit`

### Water
- `GET /api/v1/water/consumption`
- `GET /api/v1/water/efficiency`

Query params:
- `year`
- `governorate`
- `crop`

### Climate
- `GET /api/v1/climate/records`
- `GET /api/v1/climate/correlation`

Query params:
- `year`
- `governorate`

### Analytics
- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/trends`

Query params:
- `year`
- `governorate`

### Ingestion
- `POST /api/v1/ingestion/crops/upload`
- `POST /api/v1/ingestion/water/upload`
- `POST /api/v1/ingestion/climate/upload`
- `GET /api/v1/ingestion/batches/{batch_id}`

## Request/Response Examples

### Example 1: Login
Request:
```http
POST /api/v1/auth/login
Content-Type: application/json
```
```json
{
  "email": "admin@agri.local",
  "password": "secret123"
}
```

Response:
```json
{
  "status": "success",
  "data": {
    "access_token": "jwt-token",
    "token_type": "bearer"
  },
  "message": null,
  "meta": {}
}
```

### Example 2: Crop Production Query
Request:
```http
GET /api/v1/crops/production?year=2024&governorate=Giza&page=1&limit=20
```

Response:
```json
{
  "status": "success",
  "data": [
    {
      "crop": "wheat",
      "governorate": "Giza",
      "year": 2024,
      "production_tonnes": 12000.5
    }
  ],
  "message": null,
  "meta": {
    "page": 1,
    "limit": 20,
    "count": 1
  }
}
```

### Example 3: Validation Error
Response:
```json
{
  "status": "error",
  "message": "Validation error",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "year": "must be an integer"
    }
  },
  "meta": {}
}
```

## Implementation Rules
- API layer validates and forwards; no direct SQL in API files.
- Service layer owns business logic.
- Repository layer owns DB access.
- API responses must always use the standard format above.
