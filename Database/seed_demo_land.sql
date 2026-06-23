-- =====================================================================
-- DEMO SEED: Realistic Egyptian Agricultural Land
-- Location: Sharqia Governorate, Nile Delta (East of Zagazig)
-- Crop: Winter Wheat (Triticum aestivum)
-- Area: 18.6 hectares
-- GPS Center: 30.5878°N, 31.5020°E (real coordinates near Abu Kabir)
-- =====================================================================

USE agriculture;

-- ─── 1. Data Sources ─────────────────────────────────────────────────
INSERT INTO data_sources (name, confidence_score, created_at) VALUES
  ('Sentinel-2 (ESA)',       0.94, NOW()),
  ('Open-Meteo API',         0.91, NOW()),
  ('SoilGrids (ISRIC)',      0.88, NOW()),
  ('FAO AquaCrop Model',     0.85, NOW()),
  ('AgriData AI Engine',     0.82, NOW()),
  ('MODIS (NASA)',            0.90, NOW())
ON DUPLICATE KEY UPDATE confidence_score = VALUES(confidence_score);

-- Get source IDs
SET @sentinel_id  = (SELECT source_id FROM data_sources WHERE name = 'Sentinel-2 (ESA)');
SET @meteo_id     = (SELECT source_id FROM data_sources WHERE name = 'Open-Meteo API');
SET @soilgrids_id = (SELECT source_id FROM data_sources WHERE name = 'SoilGrids (ISRIC)');
SET @fao_id       = (SELECT source_id FROM data_sources WHERE name = 'FAO AquaCrop Model');
SET @ai_id        = (SELECT source_id FROM data_sources WHERE name = 'AgriData AI Engine');
SET @modis_id     = (SELECT source_id FROM data_sources WHERE name = 'MODIS (NASA)');

-- ─── 2. Land Registration ───────────────────────────────────────────
-- A wheat farm near Abu Kabir, Sharqia Governorate
-- Real GeoJSON polygon (roughly rectangular, real Nile Delta farmland)
INSERT INTO lands (user_id, name, latitude, longitude, boundary_polygon, area_hectares, description, status, monitoring_interval_days, created_at)
VALUES (
  1,  -- yassint.codes@gmail.com
  'Sharqia Delta — Abu Kabir Wheat Farm',
  30.58780000,
  31.50200000,
  '{
    "type": "Polygon",
    "coordinates": [[
      [31.4980, 30.5900],
      [31.5060, 30.5900],
      [31.5060, 30.5856],
      [31.4980, 30.5856],
      [31.4980, 30.5900]
    ]]
  }',
  18.6000,
  'Prime Nile Delta farmland east of Zagazig city in Sharqia Governorate. Irrigated via Ismailia Canal branch. Currently growing winter wheat (Giza 171 variety). Soil is alluvial clay-loam with high fertility. This plot has been under continuous cultivation for over 30 years with a wheat-rice rotation pattern.',
  'ready',
  7,
  '2025-12-01 08:00:00'
);

SET @land_id = LAST_INSERT_ID();

-- ─── 3. Climate Data (12 weeks of historical data) ─────────────────
-- Realistic Egyptian winter/spring climate for Sharqia region
INSERT INTO land_climate (land_id, timestamp, temperature_celsius, humidity_pct, rainfall_mm, source_id) VALUES
  (@land_id, '2026-02-15 06:00:00', 13.2000, 72.0000, 8.5000, @meteo_id),
  (@land_id, '2026-02-22 06:00:00', 14.5000, 68.0000, 3.2000, @meteo_id),
  (@land_id, '2026-03-01 06:00:00', 15.8000, 65.0000, 0.0000, @meteo_id),
  (@land_id, '2026-03-08 06:00:00', 17.2000, 62.0000, 0.0000, @meteo_id),
  (@land_id, '2026-03-15 06:00:00', 18.9000, 58.0000, 1.5000, @meteo_id),
  (@land_id, '2026-03-22 06:00:00', 20.4000, 55.0000, 0.0000, @meteo_id),
  (@land_id, '2026-03-29 06:00:00', 22.1000, 52.0000, 0.0000, @meteo_id),
  (@land_id, '2026-04-05 06:00:00', 23.5000, 48.0000, 0.0000, @meteo_id),
  (@land_id, '2026-04-12 06:00:00', 25.0000, 45.0000, 0.0000, @meteo_id),
  (@land_id, '2026-04-19 06:00:00', 26.8000, 42.0000, 0.0000, @meteo_id),
  (@land_id, '2026-04-26 06:00:00', 28.3000, 40.0000, 0.0000, @meteo_id),
  (@land_id, '2026-05-03 06:00:00', 29.6000, 38.0000, 0.0000, @meteo_id);

-- ─── 4. Crop Data (NDVI time-series + growth stages) ────────────────
-- Winter wheat NDVI progression: emergence → tillering → heading → ripening
INSERT INTO land_crops (land_id, timestamp, crop_type, ndvi_value, estimated_yield_tons, growth_stage, ndvi_trend, confidence, source_id) VALUES
  (@land_id, '2026-02-15 12:00:00', 'Winter Wheat (Giza 171)', 0.3200, NULL,    'emergence',     'rising',  0.8800, @sentinel_id),
  (@land_id, '2026-02-22 12:00:00', 'Winter Wheat (Giza 171)', 0.4100, NULL,    'tillering',     'rising',  0.9000, @sentinel_id),
  (@land_id, '2026-03-01 12:00:00', 'Winter Wheat (Giza 171)', 0.5300, NULL,    'tillering',     'rising',  0.9200, @sentinel_id),
  (@land_id, '2026-03-08 12:00:00', 'Winter Wheat (Giza 171)', 0.6200, NULL,    'stem_extension','rising',  0.9100, @sentinel_id),
  (@land_id, '2026-03-15 12:00:00', 'Winter Wheat (Giza 171)', 0.7100, NULL,    'stem_extension','rising',  0.9300, @sentinel_id),
  (@land_id, '2026-03-22 12:00:00', 'Winter Wheat (Giza 171)', 0.7800, 6.8000, 'heading',       'rising',  0.9400, @sentinel_id),
  (@land_id, '2026-03-29 12:00:00', 'Winter Wheat (Giza 171)', 0.8200, 7.1000, 'heading',       'stable',  0.9500, @sentinel_id),
  (@land_id, '2026-04-05 12:00:00', 'Winter Wheat (Giza 171)', 0.8000, 7.0000, 'flowering',     'stable',  0.9400, @sentinel_id),
  (@land_id, '2026-04-12 12:00:00', 'Winter Wheat (Giza 171)', 0.7500, 6.9000, 'grain_filling', 'falling', 0.9200, @sentinel_id),
  (@land_id, '2026-04-19 12:00:00', 'Winter Wheat (Giza 171)', 0.6800, 6.8000, 'grain_filling', 'falling', 0.9100, @sentinel_id),
  (@land_id, '2026-04-26 12:00:00', 'Winter Wheat (Giza 171)', 0.5600, 6.7000, 'ripening',      'falling', 0.9000, @sentinel_id),
  (@land_id, '2026-05-03 12:00:00', 'Winter Wheat (Giza 171)', 0.4200, 6.5000, 'ripening',      'falling', 0.8800, @sentinel_id);

-- ─── 5. Soil Data (baseline + monthly updates) ─────────────────────
-- Typical Nile Delta alluvial soil profile
INSERT INTO land_soil (land_id, timestamp, moisture_pct, soil_type, ph_level, organic_matter_pct, suitability_score, source_id) VALUES
  (@land_id, '2025-12-01 12:00:00', 32.0000, 'Clay Loam (Alluvial)',         7.80, 2.10, 87.50, @soilgrids_id),
  (@land_id, '2026-01-15 12:00:00', 35.5000, 'Clay Loam (Alluvial)',         7.75, 2.15, 88.00, @soilgrids_id),
  (@land_id, '2026-02-15 12:00:00', 38.2000, 'Clay Loam (Alluvial)',         7.70, 2.20, 89.00, @soilgrids_id),
  (@land_id, '2026-03-15 12:00:00', 34.0000, 'Clay Loam (Alluvial)',         7.72, 2.18, 88.50, @soilgrids_id),
  (@land_id, '2026-04-15 12:00:00', 28.5000, 'Clay Loam (Alluvial)',         7.78, 2.12, 86.00, @soilgrids_id),
  (@land_id, '2026-05-01 12:00:00', 24.0000, 'Clay Loam (Alluvial)',         7.82, 2.08, 84.50, @soilgrids_id);

-- ─── 6. Water / Irrigation Data ─────────────────────────────────────
-- Ismailia Canal irrigation with FAO-modeled water requirements
INSERT INTO land_water (land_id, timestamp, estimated_water_usage_liters, irrigation_status, crop_water_requirement_mm, water_efficiency_ratio, source_id) VALUES
  (@land_id, '2026-02-15 06:00:00', 285000.0000, 'irrigated',      22.5000, 0.7800, @fao_id),
  (@land_id, '2026-02-22 06:00:00', 310000.0000, 'irrigated',      25.0000, 0.8100, @fao_id),
  (@land_id, '2026-03-01 06:00:00', 345000.0000, 'irrigated',      28.5000, 0.8200, @fao_id),
  (@land_id, '2026-03-08 06:00:00', 380000.0000, 'irrigated',      32.0000, 0.8300, @fao_id),
  (@land_id, '2026-03-15 06:00:00', 420000.0000, 'irrigated',      36.5000, 0.8000, @fao_id),
  (@land_id, '2026-03-22 06:00:00', 465000.0000, 'irrigated',      41.0000, 0.7900, @fao_id),
  (@land_id, '2026-03-29 06:00:00', 510000.0000, 'irrigated',      45.0000, 0.7700, @fao_id),
  (@land_id, '2026-04-05 06:00:00', 550000.0000, 'irrigation_due', 48.5000, 0.7500, @fao_id),
  (@land_id, '2026-04-12 06:00:00', 580000.0000, 'irrigated',      52.0000, 0.7600, @fao_id),
  (@land_id, '2026-04-19 06:00:00', 540000.0000, 'irrigated',      49.0000, 0.7800, @fao_id),
  (@land_id, '2026-04-26 06:00:00', 450000.0000, 'irrigated',      38.0000, 0.8200, @fao_id),
  (@land_id, '2026-05-03 06:00:00', 320000.0000, 'drying_down',    24.0000, 0.8500, @fao_id);

-- ─── 7. Satellite Images ────────────────────────────────────────────
-- True color + NDVI pairs from Sentinel-2 passes
INSERT INTO land_images (land_id, timestamp, image_path, image_type, ndvi_mean, cloud_cover_pct, cv_analysis_summary, source_id) VALUES
  (@land_id, '2026-02-15 10:30:00', '/data/images/sharqia_20260215_true_color.tif', 'true_color', NULL,   5.20, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "excellent"}', @sentinel_id),
  (@land_id, '2026-02-15 10:30:00', '/data/images/sharqia_20260215_ndvi.tif',       'ndvi',       0.3200, 5.20, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.12, "max": 0.48, "std": 0.09}', @sentinel_id),

  (@land_id, '2026-03-02 10:30:00', '/data/images/sharqia_20260302_true_color.tif', 'true_color', NULL,   2.80, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "excellent"}', @sentinel_id),
  (@land_id, '2026-03-02 10:30:00', '/data/images/sharqia_20260302_ndvi.tif',       'ndvi',       0.5300, 2.80, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.31, "max": 0.72, "std": 0.11}', @sentinel_id),

  (@land_id, '2026-03-17 10:30:00', '/data/images/sharqia_20260317_true_color.tif', 'true_color', NULL,   8.50, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "good"}', @sentinel_id),
  (@land_id, '2026-03-17 10:30:00', '/data/images/sharqia_20260317_ndvi.tif',       'ndvi',       0.7100, 8.50, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.52, "max": 0.85, "std": 0.08}', @sentinel_id),

  (@land_id, '2026-04-01 10:30:00', '/data/images/sharqia_20260401_true_color.tif', 'true_color', NULL,   1.20, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "excellent"}', @sentinel_id),
  (@land_id, '2026-04-01 10:30:00', '/data/images/sharqia_20260401_ndvi.tif',       'ndvi',       0.8100, 1.20, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.65, "max": 0.92, "std": 0.06}', @sentinel_id),

  (@land_id, '2026-04-16 10:30:00', '/data/images/sharqia_20260416_true_color.tif', 'true_color', NULL,   3.40, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "good"}', @sentinel_id),
  (@land_id, '2026-04-16 10:30:00', '/data/images/sharqia_20260416_ndvi.tif',       'ndvi',       0.7200, 3.40, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.54, "max": 0.86, "std": 0.09}', @sentinel_id),

  (@land_id, '2026-05-01 10:30:00', '/data/images/sharqia_20260501_true_color.tif', 'true_color', NULL,   0.80, '{"bands": "B04,B03,B02", "resolution_m": 10, "quality": "excellent"}', @sentinel_id),
  (@land_id, '2026-05-01 10:30:00', '/data/images/sharqia_20260501_ndvi.tif',       'ndvi',       0.4200, 0.80, '{"formula": "(B08-B04)/(B08+B04)", "min": 0.22, "max": 0.58, "std": 0.10}', @sentinel_id);

-- ─── 8. Alerts ──────────────────────────────────────────────────────
INSERT INTO land_alerts (land_id, timestamp, alert_type, severity, message, payload, source_id) VALUES
  (@land_id, '2026-04-05 14:00:00', 'water_stress', 'warning',
   'Soil moisture dropped to 28.5% — below the 30% optimal threshold for wheat during grain filling stage. Schedule irrigation within 48 hours to prevent yield loss.',
   '{"moisture_pct": 28.5, "threshold_pct": 30.0, "growth_stage": "grain_filling", "estimated_yield_impact": "-3%"}',
   @ai_id),

  (@land_id, '2026-04-19 14:00:00', 'ndvi_decline', 'info',
   'NDVI declined from 0.82 (peak) to 0.68 over 3 weeks. This is consistent with normal senescence patterns for wheat approaching harvest maturity.',
   '{"ndvi_peak": 0.82, "ndvi_current": 0.68, "decline_pct": 17.1, "expected_for_stage": true}',
   @ai_id),

  (@land_id, '2026-05-01 14:00:00', 'harvest_window', 'info',
   'Optimal harvest window estimated: May 15–22, 2026. Grain moisture currently at ~14% and declining. Delay beyond May 25 risks shattering losses of 5–8%.',
   '{"estimated_harvest_start": "2026-05-15", "estimated_harvest_end": "2026-05-22", "grain_moisture_pct": 14.0, "risk_after": "2026-05-25", "shattering_risk_pct": "5-8%"}',
   @ai_id),

  (@land_id, '2026-04-12 09:00:00', 'temperature_spike', 'warning',
   'Temperature reached 35.2°C on April 12 — exceeding the 32°C heat stress threshold for wheat during flowering. Brief heat events can reduce grain count by 10–15%.',
   '{"max_temp": 35.2, "threshold": 32.0, "duration_hours": 6, "growth_stage": "flowering", "potential_impact": "reduced_grain_count"}',
   @meteo_id);

-- ─── 9. Analytics Summaries (AI-generated insights) ─────────────────
INSERT INTO analytics_summaries (land_id, timestamp, summary_text, summary_payload, source_id) VALUES
  (@land_id, '2026-03-29 18:00:00',
   'Mid-season analysis: The Sharqia wheat farm is performing above regional average. NDVI peaked at 0.82 during heading stage, placing this plot in the top 15% of Sharqia wheat farms. Soil conditions remain favorable with pH 7.7 and organic matter at 2.2%. Current estimated yield: 7.1 tons/hectare (vs regional average of 6.3 t/ha). Recommend maintaining current irrigation schedule.',
   '{"ndvi_peak": 0.82, "regional_avg_ndvi": 0.71, "percentile": 85, "yield_estimate_t_ha": 7.1, "regional_avg_yield": 6.3, "recommendation": "maintain_current_schedule"}',
   @ai_id),

  (@land_id, '2026-04-26 18:00:00',
   'Pre-harvest analysis: Wheat is in late ripening stage with NDVI at 0.56 — consistent with expected senescence. Estimated final yield: 6.7 t/ha (total ~124.6 tons for 18.6 ha). Grain filling was slightly impacted by the April 12 heat spike, reducing final yield by an estimated 5% from peak projection. Water efficiency was 80% overall — recommend drip irrigation upgrade for the next rice cycle to improve to 90%+.',
   '{"ndvi_current": 0.56, "yield_estimate_t_ha": 6.7, "total_yield_tons": 124.62, "heat_impact_pct": 5, "water_efficiency_avg": 0.80, "recommendation": "drip_irrigation_upgrade", "next_crop": "rice", "planting_window": "2026-06-01 to 2026-06-15"}',
   @ai_id),

  (@land_id, '2026-05-05 18:00:00',
   'Harvest readiness report: All indicators confirm the wheat is ready for harvest. NDVI has dropped to 0.42, grain moisture is estimated at 13.5% (optimal range 12-14%). Recommended harvest window: May 15–22. Market analysis shows current wheat prices at 12,500 EGP/ton — a 4% premium over the 3-month average. Selling within the first week of harvest could maximize revenue. Estimated gross revenue: ~1,557,750 EGP for 124.6 tons.',
   '{"harvest_ready": true, "grain_moisture_pct": 13.5, "optimal_range": "12-14%", "market_price_egp_ton": 12500, "price_premium_pct": 4, "estimated_revenue_egp": 1557750, "recommended_action": "harvest_and_sell_immediately"}',
   @ai_id);

-- ─── Verify ─────────────────────────────────────────────────────────
SELECT CONCAT('✅ Land seeded: ID=', @land_id, ' | Name=Sharqia Delta — Abu Kabir Wheat Farm') AS result;
SELECT CONCAT('   📊 Climate records: ', COUNT(*)) AS result FROM land_climate WHERE land_id = @land_id;
SELECT CONCAT('   🌾 Crop records: ', COUNT(*)) AS result FROM land_crops WHERE land_id = @land_id;
SELECT CONCAT('   🧪 Soil records: ', COUNT(*)) AS result FROM land_soil WHERE land_id = @land_id;
SELECT CONCAT('   💧 Water records: ', COUNT(*)) AS result FROM land_water WHERE land_id = @land_id;
SELECT CONCAT('   🛰️ Image records: ', COUNT(*)) AS result FROM land_images WHERE land_id = @land_id;
SELECT CONCAT('   ⚠️ Alert records: ', COUNT(*)) AS result FROM land_alerts WHERE land_id = @land_id;
SELECT CONCAT('   🤖 Analytics: ', COUNT(*)) AS result FROM analytics_summaries WHERE land_id = @land_id;
