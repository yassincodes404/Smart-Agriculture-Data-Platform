# Phase 3 - Event 2: Land Monitoring Pipeline

This pipeline forms the "Historical Tracking" backbone, transforming a static snapshot into a living intelligence system.

## 1. Scheduler Trigger
Requires a Cron job or Task Scheduler (e.g., Celery Beat, APScheduler).
- **Frequency:** Daily (or weekly depending on API limits).
- **Action:** Iterate over all active `Land` entries.

## 2. Targeted Data Collection (Update)
The system DOES NOT pull static CV images or manual uploads again. It specifically queries time-variant APIs:
1. Fetch Yesterday's Climate Data.
2. Fetch Latest NDVI Satellite readings.
3. Fetch calculated Water usage rates.

## 3. Time-Series Append
Data is extracted, transformed to standard units, and appended.
- `INSERT INTO land_climate ...`
- `INSERT INTO land_water ...`
Results in a rich ledger of changes linked to a single `land_id`.

## 4. Change Detection Layer
Run an analytics module across the time-series arrays for proper context:
- Compare: `current_ndvi` vs `rolling_avg_ndvi(7_days)`.
- Delta: +12% Moisture, -5% Temperature.

## 5. AI Summary Engine
Pass the raw time-series diff to the AI Service (Gemini).
**Prompt Construct:**
> "Land 123 in [Region]. Over the past week, temperature increased by 2C and moisture dropped by 10%. Summarize the agricultural risk in 2 sentences."
**Output Storage:** Save insights to an `analytics_summaries` table or append to the `land_images` generic insight JSON.

## 6. Visualization API Layer
**Endpoints:**
- `GET /api/v1/lands/{land_id}/timeseries?metric=climate` (and `water` | `crops` | `soil`)
- Returns arrays strictly formatted for Frontend Charting (e.g., Recharts or Chart.js).
