# Agricultural Decision Engine — Feature List

> **System Identity**: This is NOT a "data collection app". It is an **Agricultural Decision Engine**.  
> Every feature answers a real question: `Question → Data Fusion → Answer`

---

## Data Sources Available

| Source | Type | Provider | Status |
|--------|------|----------|--------|
| Satellite imagery | GeoTIFF → NDVI | Copernicus Sentinel-2 | 🔴 Not connected |
| Climate data | Temperature, humidity, rainfall | Open-Meteo API | 🟢 Connected |
| Water models | ET₀-based crop water needs | FAO Kc coefficients | 🔴 Not connected |
| Soil data | Type, moisture, pH | SoilGrids / ISRIC | 🔴 Not connected |
| Crop statistics | Regional yield/production | FAOSTAT / CAPMAS | 🔴 Not connected |
| CV / AI outputs | Image analysis | agri_cv container | 🟡 Container exists |

---

## 🥇 Tier 1 — CORE VALUE (Priority: Highest)

### F1.1 — Crop Detection
- **Question**: What crop is growing here?
- **Method**: NDVI time-series pattern matching + ML classification
- **Confidence**: ~85% with sufficient NDVI history
- **Output**: `{ "crop": "wheat", "confidence": 0.85 }`
- **Endpoint**: `GET /api/v1/lands/{id}/crop-detection`

### F1.2 — Crop Growth Stage
- **Question**: What stage is the crop in?
- **Method**: NDVI curve mapped to growth stages (planting → vegetative → flowering → maturity → harvest)
- **Output**: `{ "stage": "vegetative", "days_in_stage": 15, "expected_duration": 35 }`
- **Endpoint**: `GET /api/v1/lands/{id}/crop-status`

### F1.3 — Harvest Prediction
- **Question**: When is harvest time (الحصاد)?
- **Method**: NDVI peak detection + crop cycle duration + climate adjustment
- **Output**: `{ "estimated_harvest_date": "2026-06-15", "confidence": "high", "days_remaining": 52 }`
- **Endpoint**: `GET /api/v1/lands/{id}/harvest-prediction`

### F1.4 — Crop Health Assessment
- **Question**: Is the crop healthy?
- **Method**: Current NDVI compared to normal/expected levels for the crop type and growth stage
- **Output**: `{ "health_score": 78, "status": "good", "ndvi_current": 0.65, "ndvi_expected": 0.70 }`
- **Endpoint**: `GET /api/v1/lands/{id}/crop-health`

### F1.5 — Crop Trend Analysis
- **Question**: Is the crop improving or declining?
- **Method**: Time-series NDVI regression analysis
- **Output**: `{ "trend": "declining", "risk": "medium", "change_7d": -0.05 }`
- **Endpoint**: `GET /api/v1/lands/{id}/crop-trend`

### F1.6 — Time-Series Visualization
- **Question**: What changed in this land over time?
- **Method**: Multi-metric time-series (NDVI + climate + water)
- **Output**: Array of timestamped data points for charting
- **Endpoint**: `GET /api/v1/lands/{id}/timeseries?metric=climate|water|crops|soil`

---

## 🥈 Tier 2 — STRONG (Priority: High)

### F2.1 — Water Needs Estimation
- **Question**: How much water does this crop need?
- **Method**: Crop type × FAO ET₀ reference × crop coefficient (Kc)
- **Output**: `{ "daily_requirement_mm": 5.2, "weekly_requirement_mm": 36.4, "crop_coefficient": 1.15 }`
- **Endpoint**: `GET /api/v1/lands/{id}/water-needs`

### F2.2 — Irrigation Status
- **Question**: Is the land over-irrigated or under-irrigated?
- **Method**: NDVI + climate + water model fusion
- **Output**: `{ "water_status": "overuse", "excess_pct": 25, "recommendation": "reduce irrigation by 25%" }`
- **Endpoint**: `GET /api/v1/lands/{id}/irrigation-status`

### F2.3 — Water Efficiency
- **Question**: What is water efficiency?
- **Method**: Estimated water usage per ton of estimated yield
- **Output**: `{ "liters_per_ton": 1200, "efficiency_rating": "moderate" }`
- **Endpoint**: `GET /api/v1/lands/{id}/water-efficiency`

### F2.4 — Climate Suitability
- **Question**: Is the weather suitable for this crop?
- **Method**: Crop temperature/humidity requirements vs actual NASA/ECMWF climate data
- **Output**: `{ "suitable": true, "temp_score": 85, "humidity_score": 70, "overall_score": 78 }`
- **Endpoint**: `GET /api/v1/lands/{id}/climate-suitability`

### F2.5 — Climate Stress Detection
- **Question**: Is there climate stress?
- **Method**: Heatwave detection (consecutive days >40°C), drought signals (low rainfall periods)
- **Output**: `{ "stress_detected": true, "type": "heat_stress", "severity": "moderate", "consecutive_hot_days": 5 }`
- **Endpoint**: `GET /api/v1/lands/{id}/climate-stress`

### F2.6 — Yield Estimation
- **Question**: What is the expected yield?
- **Method**: NDVI + climate + regional statistics (FAOSTAT/CAPMAS)
- **Accuracy**: Estimated, not exact (±20-30%)
- **Output**: `{ "estimated_yield_tons_per_hectare": 3.2, "confidence": "moderate", "regional_avg": 2.8 }`
- **Endpoint**: `GET /api/v1/lands/{id}/yield-estimate`

### F2.7 — Yield Trend
- **Question**: Is yield increasing or decreasing?
- **Method**: Multi-season time-series analysis
- **Output**: `{ "trend": "increasing", "change_yoy_pct": 8.5 }`
- **Endpoint**: `GET /api/v1/lands/{id}/yield-trend`

### F2.8 — Regional Comparison
- **Question**: How does this land compare to others?
- **Method**: Compare NDVI/yield/water against regional averages
- **Output**: `{ "percentile": 72, "above_average": true, "comparison_area": "Dakahlia Governorate" }`
- **Endpoint**: `GET /api/v1/lands/{id}/regional-comparison`

---

## 🥉 Tier 3 — ADVANCED (Priority: Medium)

### F3.1 — Anomaly Detection
- **Question**: Are there anomalies?
- **Method**: Sudden NDVI drop detection, unusual climate patterns
- **Output**: `{ "anomalies": [{ "type": "ndvi_sudden_drop", "date": "2026-04-20", "severity": "high" }] }`
- **Endpoint**: `GET /api/v1/lands/{id}/anomalies`

### F3.2 — Crop Failure Risk
- **Question**: Is there risk of crop failure?
- **Method**: Probabilistic model combining NDVI trend + climate stress + water deficit
- **Output**: `{ "risk_level": "medium", "risk_score": 45, "contributing_factors": ["declining_ndvi", "heat_stress"] }`
- **Endpoint**: `GET /api/v1/lands/{id}/risk-assessment`

### F3.3 — Land Summary
- **Question**: Give me a summary of this land
- **Method**: Full data fusion across all sources → AI-generated narrative
- **Output**: `{ "summary": "Land 123 in Nile Delta shows healthy wheat in mid-growth stage...", "key_metrics": {...} }`
- **Endpoint**: `GET /api/v1/lands/{id}/summary`

### F3.4 — AI Recommendations
- **Question**: What should I do next?
- **Method**: Rule-based + AI (Gemini) recommendations based on current state
- **Output**: `{ "recommendations": ["Reduce irrigation by 15%", "Monitor for disease risk", "Expected harvest in 3 weeks"] }`
- **Endpoint**: `GET /api/v1/lands/{id}/recommendations`

### F3.5 — Soil Suitability
- **Question**: Is this soil suitable for this crop?
- **Method**: Soil type + moisture + pH vs crop requirements
- **Output**: `{ "suitable": true, "suitability_score": 72, "limiting_factor": "ph_slightly_high" }`
- **Endpoint**: `GET /api/v1/lands/{id}/soil-suitability`

### F3.6 — Soil Status
- **Question**: Is soil moisture sufficient?
- **Method**: Satellite soil moisture (SMAP) or modeled from rainfall + soil type
- **Output**: `{ "moisture_pct": 35, "status": "adequate", "optimal_range": [30, 45] }`
- **Endpoint**: `GET /api/v1/lands/{id}/soil-status`

---

## 📸 Satellite Time-Series (Visual Feature)

### F4.1 — Land Image Gallery
- **Feature**: Satellite images of the same land over time (growth tracking)
- **Source**: Sentinel-2 (revisit every ~5 days)
- **Image Types**: True-color (RGB) + NDVI (health map)
- **Storage**: `data/images/lands/{land_id}/YYYY-MM-DD_true.png`, `_ndvi.png`
- **Endpoint**: `GET /api/v1/lands/{id}/images`
- **Response**: `{ "images": [{ "date": "2026-01-01", "type": "true_color", "url": "..." }, ...] }`

### F4.2 — Individual Image
- **Endpoint**: `GET /api/v1/lands/{id}/images/{image_id}`
- **Response**: Image file or metadata with download URL

---

## ❌ Known Limitations

| Question | Answer | Reason |
|----------|--------|--------|
| Exact production of THIS land | ❌ Estimate only | No ground-truth field data |
| Exact water used | ❌ Modeled only | No IoT sensors |
| Land ownership | ❌ Not available | No access to cadastral data |
| Sub-meter resolution | ❌ Not available | Sentinel-2 = 10m resolution |

---

## Endpoint Summary (Complete)

| Method | Path | Feature | Tier |
|--------|------|---------|------|
| `POST` | `/api/v1/lands/discover` | Land onboarding | Existing |
| `GET` | `/api/v1/lands/{id}/timeseries` | Time-series data | Existing (extend) |
| `GET` | `/api/v1/lands/{id}/crop-detection` | Crop identification | Tier 1 |
| `GET` | `/api/v1/lands/{id}/crop-status` | Growth stage | Tier 1 |
| `GET` | `/api/v1/lands/{id}/crop-health` | Health assessment | Tier 1 |
| `GET` | `/api/v1/lands/{id}/crop-trend` | Trend analysis | Tier 1 |
| `GET` | `/api/v1/lands/{id}/harvest-prediction` | Harvest timing | Tier 1 |
| `GET` | `/api/v1/lands/{id}/water-needs` | Water requirements | Tier 2 |
| `GET` | `/api/v1/lands/{id}/irrigation-status` | Irrigation assessment | Tier 2 |
| `GET` | `/api/v1/lands/{id}/water-efficiency` | Water efficiency | Tier 2 |
| `GET` | `/api/v1/lands/{id}/climate-suitability` | Climate matching | Tier 2 |
| `GET` | `/api/v1/lands/{id}/climate-stress` | Stress detection | Tier 2 |
| `GET` | `/api/v1/lands/{id}/yield-estimate` | Yield prediction | Tier 2 |
| `GET` | `/api/v1/lands/{id}/yield-trend` | Yield trend | Tier 2 |
| `GET` | `/api/v1/lands/{id}/regional-comparison` | Area comparison | Tier 2 |
| `GET` | `/api/v1/lands/{id}/anomalies` | Anomaly detection | Tier 3 |
| `GET` | `/api/v1/lands/{id}/risk-assessment` | Risk scoring | Tier 3 |
| `GET` | `/api/v1/lands/{id}/summary` | Land summary | Tier 3 |
| `GET` | `/api/v1/lands/{id}/recommendations` | AI recommendations | Tier 3 |
| `GET` | `/api/v1/lands/{id}/soil-suitability` | Soil matching | Tier 3 |
| `GET` | `/api/v1/lands/{id}/soil-status` | Soil moisture | Tier 3 |
| `GET` | `/api/v1/lands/{id}/images` | Satellite gallery | Visual |
| `GET` | `/api/v1/lands/{id}/images/{image_id}` | Individual image | Visual |

**Total: 23 new endpoints + 2 existing**

---

*Document created: 2026-04-24*  
*Aligned with: Developer_and_AI_Continuation_Guide.md, Geospatial System Architecture docs*
