# Fix Land Pipeline, NDVI, and AI Data Issues

I have investigated all three issues. They are deeply interconnected, stemming from a missing reference file and some strict UI status checks.

## User Review Required
Please review the proposed plan below. Let me know if you approve these fixes or if you have any questions before I proceed with execution.

## Root Causes & Proposed Changes

### 1. Lands get stuck in "Processing" and NEVER finish
**Cause:** 
When the pipeline encounters non-fatal warnings (e.g., skipping a step due to missing API keys or missing reference data), it correctly finishes but marks the land status as `"active_partial"`. However, the UI (Dashboard and Compare Lands pages) only considers `"ready"`, `"active"`, and `"completed"` as finished states. Anything else falls into a catch-all `"Processing"` bucket on the frontend, making it look like it's hanging forever. Additionally, fetching 30 high-res Sentinel-2 images sequentially can take 15+ minutes.
**Fix:**
- Update `DashboardPage.jsx` and `CompareLandsPage.jsx` to explicitly treat `"active_partial"` as a completed state so they populate the pie chart and stop spinning.
- Optimize `sentinel_task.py` to only fetch the latest 5 visual satellite images instead of 30, reducing pipeline runtime from ~15 minutes down to ~1-2 minutes.

### 2. NDVI, Crop Health, Primary Crop, and Days to Harvest show No Data
**Cause:**
The `crop_detection` backend task relies on a reference file called `crop_profiles.json` to match pixel data to crop types (e.g., matching an NDVI peak of 0.85 to Corn). This file is entirely missing from your repository! Because it's missing, the backend throws a fatal `ValueError: min() arg is an empty sequence` when trying to classify the crops. This crashes the entire crop step, meaning no NDVI data, zones, or harvest estimates are ever saved to the database.
**Fix:**
- Create the missing `crop_profiles.json` file in `services/backend/app/data/reference/` with standard profiles for crops like Alfalfa, Wheat, Corn, Cotton, and Tomatoes.
- Add safety fallbacks in `identification.py` so that if the profile list is ever empty again, it gracefully defaults to "Unknown Crop" instead of crashing the pipeline.

### 3. Crop Intelligence shows No Data
**Cause:**
The AI Agronomist requires the crop and spectral history (NDVI) data to generate insights. Because the crop detection step crashed (see above), the AI had absolutely zero crop data to analyze. Furthermore, if you haven't set up a Groq API key, the AI step quietly skips, but adds an `"ai_analysis"` warning, contributing to the `"active_partial"` status loop.
**Fix:**
- Fixing Issue #2 will automatically fix this, as the AI will now receive the proper crop data.
- Ensure the AI step gracefully handles missing Groq keys without throwing disruptive warnings.

## Verification Plan
1. Apply the fixes and create the missing `crop_profiles.json`.
2. I will instruct you to test creating a brand new Land.
3. The pipeline should complete much faster (~1-2 minutes).
4. The status should turn green/warning but clearly show as finished.
5. The Land details page should successfully render the NDVI charts, crop health, primary crop, and AI intelligence sections.
