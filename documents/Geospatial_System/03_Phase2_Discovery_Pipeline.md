# Phase 2 - Event 1: Land Discovery Pipeline

This pipeline handles onboarding a exact location and building its initial Enriched Data Profile.
**CRITICAL:** API logic must only orchestrate the trigger; data processing happens asynchronously.

## 1. Input Layer (FastAPI Endpoint)
**Endpoint:** `POST /api/v1/lands/discover` (versioned like the rest of the backend)
**Payload:**
```json
{
  "latitude": 30.0444,
  "longitude": 31.2357,
  "name": "Nile Delta Plot 1",
  "image": "<base64_or_multipart> (Optional)"
}
```
**Action:**
1. Validate Coords.
2. Insert empty `Land` record into DB (synchronous).
3. If an image is provided, securely save to `data/images/`.
4. Trigger the Background Processing Pipeline (passing `land_id`).
5. **Return:** 202 Accepted `{"status": "processing", "land_id": "123"}`.

## 2. Asynchronous Execution Pipeline (Celery / Background Tasks)
Once triggered, the background worker kicks off parallel tasks:

### Step 2a: Geo-Accuracy Layer
Calculate boundary rules. If the radius is 1km, generate a geo-fence. Assert that subsequent APIs receive parameters strictly querying the bounds of `[lat, long, radius]`.

### Step 2b: Data Connectors (Scatter)
Fetch data from external APIs in parallel:
- **Climate Worker:** Hits APIs (e.g., OpenMeteo) using Exact GPS.
- **Water/Crop Worker:** Queries specialized satellite integrations.
- **Scraper Engine (Optional):** Triggers asynchronous document scraping specifically limited by regional tags derived from the coordinates.

### Step 2c: CV & AI Analysis
Trigger the `agri_cv` container logic (if an image exists):
- **OpenCV Script:** Segments land and detects green areas.
- **AI Summary:** Prompts LLM (Gemini) with: `Image stats + Extracted Climate data`.

### Step 2d: ETL & Data Normalization
All collected payloads must hit the ETL transformation module:
- Standardize temperatures to Celsius.
- Normalize timestamps to UTC.

### Step 2e: Storage (Gather)
Insert structured records:
- `INSERT INTO land_climate`
- `INSERT INTO land_crops`
- `INSERT INTO land_images`

## 3. Final Output
The system transitions the `Land` status from "Processing" to "Active". The Frontend dashboard can now fetch a fully enriched profile for that exact longitude/latitude.
