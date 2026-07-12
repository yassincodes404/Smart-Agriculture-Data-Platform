# Features and Pages

## 1. MVP vs Optional Features

**MUST BUILD (MVP)**
- Dashboard
- Map + Add Land
- Land Details
- Satellite Viewer
- Charts
- Alerts
- Profile
- Methodology

**OPTIONAL (Build Later)**
- Logs page
- Comparison
- Advanced analytics

## 2. Page Details

### Dashboard Page (`/dashboard`)
**Purpose:** Global overview of user lands and intelligence.
- **Section 1: Overview Cards:** Total Lands, Average NDVI, Active Alerts, Harvest Soon.
- **Section 2: Intelligence Feed:** (MOST IMPORTANT) NDVI drop detected, Water stress, Growth improving.
- **Section 3: Recent Lands:** Grid/cards.
- **Section 4: Mini Charts:** NDVI trend, health distribution.

### Map / Add Land System (`/lands/new`) (CORE FEATURE)
- **Map:** Leaflet.
- **Drawing:** Polygon drawing by user.
- **Validation:** Minimum size, valid polygon.
- **Form:** Land Name, Tracking Frequency, Primary Crop, Tracking Variables.
- **Submission:** Creates land, triggers pipeline. Loading states (Analyzing...).

### Lands Explorer Page (`/lands`)
**Purpose:** Browse/search all lands.
- **Search:** By name, crop, status.
- **Filters:** Healthy, Warning, Harvest Soon.
- **View:** Grid/List. Shows satellite preview, NDVI status, last update.

### Land Details Page (`/lands/:id`) (MOST IMPORTANT PAGE)
**Purpose:** Main intelligence page.
- **A. Header:** Land Name, Location, Area, Health Status.
- **B. Satellite Viewer:** True Color / NDVI modes. Timeline Slider. Layer Toggle.
- **C. Key Metrics:** NDVI, Temp, Humidity, Rainfall, Crop Type, Harvest Prediction.
- **D. Graphs:** NDVI over time, Climate over time.
- **E. Soil Intelligence:** pH, Organic Carbon, Suitability, Recommendations.
- **F. Alerts Section:** Water stress, NDVI decline, Harvest window.
- **G. AI Insights:** Human-readable summaries.

### Land Comparison Page (`/lands/compare`) (OPTIONAL)
**Purpose:** Compare lands.
- **Features:** Compare NDVI, growth, soil, yield.
- **Layout:** Land A vs Land B side-by-side charts and metrics.

### User Profile Page (`/profile`)
- **Features:** Name, Email, Tracked Lands, Total Area.
- **Optional:** Preferences (default tracking frequency).

### Data & Methodology Page (`/methodology`)
- **Explain:** Data sources (MODIS, Sentinel, SoilGrids, Open-Meteo), NDVI calculation.
- **Formula:** `NDVI = (B08 - B04) / (B08 + B04)`
- **Demo:** Run demo button showing calculation.

### Team Page (`/team`)
- **Showcase:** Name, Role, Description.

### About Project Page (`/about`)
- **Explain:** Project goal, system idea, technologies.

### Logs / Monitoring Page (`/logs`) (OPTIONAL)
- **Features:** Pipeline status, Task logs, Errors, Processing history.

## 3. Global Behaviors & Alert System
- **Alerts:** Appear in dashboard, land details, notifications.
- **Loading:** "Analyzing...", "Loading imagery...".
- **Empty:** "No lands yet".
- **Error:** "Failed to load imagery".
