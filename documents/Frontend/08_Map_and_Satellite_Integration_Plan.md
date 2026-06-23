# 08 — Map Drawing & Satellite Image Integration Plan

> **Status:** Ready for implementation
> **Priority:** 🔴 Critical — This is the ENTRY POINT of the entire system
> **Dependencies:** Leaflet, leaflet-draw, backend `/lands/discover` endpoint (already built)

---

## 📌 Overview

The platform needs two critical map-related features:

| Feature | What it does | Complexity |
|---|---|---|
| **Map Drawing UI** | User draws a polygon on a map → sends GeoJSON to backend | ⭐ Easy |
| **Satellite Image Display** | Show real satellite imagery (True Color + NDVI) on land pages | ⭐⭐ Medium |
| **Image Pipeline** | Backend fetches, processes, converts satellite data into viewable images | ⭐⭐⭐ Advanced |

---

## 🏗️ Phase 1 — Map Drawing UI (Add Land Page)

### 1.1 Architecture

```
┌─────────────────────────────────────────────────┐
│                  AddLandPage.jsx                 │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           MapDrawComponent.jsx              │  │
│  │                                             │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │         Leaflet Map                   │  │  │
│  │  │    (OpenStreetMap tile layer)          │  │  │
│  │  │                                       │  │  │
│  │  │  Draw toolbar:                        │  │  │
│  │  │    🔷 Polygon  ⭕ Circle              │  │  │
│  │  │                                       │  │  │
│  │  │  Center: Egypt (26.8°N, 30.8°E)       │  │  │
│  │  │  Zoom: 7 (country view)               │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                             │  │
│  │  Returns: GeoJSON Polygon + area preview    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │           Land Registration Form            │  │
│  │  - Land Name (required)                     │  │
│  │  - Description (optional)                   │  │
│  │  - Area preview (auto-calculated)           │  │
│  │  - Coordinates preview                      │  │
│  │  - [Submit] → POST /api/v1/lands/discover   │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 1.2 NPM Packages

```bash
npm install leaflet react-leaflet @react-leaflet/core
npm install leaflet-draw
```

| Package | Purpose | Size |
|---|---|---|
| `leaflet` | Core map engine | ~40KB gzip |
| `react-leaflet` | React wrapper for Leaflet | ~8KB gzip |
| `leaflet-draw` | Drawing toolbar (polygon, circle, rectangle) | ~15KB gzip |

### 1.3 Component Structure

```
src/
  components/
    map/
      MapDrawComponent.jsx    ← Main drawing map
      MapViewComponent.jsx    ← Read-only map for land details
      mapStyles.css           ← Leaflet overrides + draw toolbar styling
```

### 1.4 MapDrawComponent — Exact Behavior

```
1. User opens /lands/new
2. Map renders centered on Egypt (zoom 7)
3. Toolbar shows: [Draw Polygon] [Draw Circle]
4. User clicks "Draw Polygon"
5. User clicks on map to place vertices
6. Double-click to finish polygon
7. Component captures GeoJSON Polygon:
   {
     "type": "Polygon",
     "coordinates": [[[lng1, lat1], [lng2, lat2], ...]]
   }
8. Area is calculated client-side (approximate display only)
9. User fills form: Land Name, Description
10. Submit → POST /api/v1/lands/discover
    Body: { name, description, geometry }
11. Backend returns: { status: "processing", land_id }
12. Frontend shows: "Analyzing your land..."
13. Redirect to /lands/:id after delay
```

### 1.5 Backend Endpoint (ALREADY EXISTS)

```
POST /api/v1/lands/discover
```

**Request:**
```json
{
  "name": "My Wheat Farm",
  "description": "Eastern delta plot near Zagazig",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[31.498, 30.590], [31.506, 30.590], [31.506, 30.586], [31.498, 30.586], [31.498, 30.590]]]
  }
}
```

**Response:**
```json
{ "status": "processing", "land_id": 5 }
```

The backend already:
- ✅ Validates the polygon (min 3 unique points)
- ✅ Closes the ring if needed
- ✅ Computes centroid (lat/lon)
- ✅ Computes area in hectares
- ✅ Stores boundary_polygon as JSON
- ✅ Enqueues discovery pipeline

### 1.6 Map Configuration

```javascript
// Default view: Egypt
const EGYPT_CENTER = [26.8, 30.8];
const EGYPT_ZOOM = 7;

// Tile layer: OpenStreetMap (FREE, no API key)
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

// Alternative: Esri Satellite (FREE, real imagery)
const SATELLITE_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
```

### 1.7 Circle-to-Polygon Conversion

When user draws a circle, convert to polygon client-side:

```javascript
function circleToPolygon(center, radiusMeters, numPoints = 32) {
  const coords = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const lat = center.lat + (dy / 111320);
    const lng = center.lng + (dx / (111320 * Math.cos(center.lat * Math.PI / 180)));
    coords.push([lng, lat]);
  }
  coords.push(coords[0]); // close ring
  return { type: "Polygon", coordinates: [coords] };
}
```

### 1.8 CSS Requirements

```css
/* Import Leaflet CSS in main.jsx */
@import 'leaflet/dist/leaflet.css';
@import 'leaflet-draw/dist/leaflet.draw.css';

/* Custom overrides for dark theme */
.leaflet-draw-toolbar { ... }
.map-draw-container { height: 500px; border-radius: var(--radius-lg); }
```

---

## 🛰️ Phase 2 — Satellite Image Display (Land Details Page)

### 2.1 Two Layers of Images

| Layer | Purpose | Source | Format |
|---|---|---|---|
| **Scientific** | NDVI calculation, analysis | Sentinel-2 (ESA) | GeoTIFF (.tif) |
| **Visual** | UI display to user | Processed from above | PNG/WebP |

### 2.2 Current State

- ✅ `land_images` table exists with paths and metadata
- ✅ 12 image records seeded (6 true_color + 6 NDVI)
- ✅ API endpoint `GET /lands/{id}/images` returns image list
- ❌ Actual image files don't exist yet (paths are placeholders)
- ❌ No image serving endpoint on the backend

### 2.3 Image Display Strategy

**Option A — Static Map Tiles (Recommended for MVP)**
- Use Esri World Imagery as base layer (free satellite tiles)
- Overlay the land boundary polygon on the map
- Show NDVI data as colored overlays

**Option B — Real Processed Images (Full Pipeline)**
- Backend fetches Sentinel-2 via Microsoft Planetary Computer STAC API
- Processes bands → True Color composite + NDVI heatmap
- Converts to PNG → serves via static file endpoint
- Frontend displays in image gallery

### 2.4 MapViewComponent — Read-Only Map on Land Details

```
┌──────────────────────────────────────────┐
│             Land Details Map              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Esri Satellite Tile Layer         │  │
│  │                                    │  │
│  │      ┌─────────────┐              │  │
│  │      │  Land        │  ← GeoJSON  │  │
│  │      │  Boundary    │    polygon   │  │
│  │      │  (green      │    overlay   │  │
│  │      │   outline)   │              │  │
│  │      └─────────────┘              │  │
│  │                                    │  │
│  │  [True Color] [NDVI] [Boundary]   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Centroid marker • Area label            │
└──────────────────────────────────────────┘
```

### 2.5 NDVI Heatmap Overlay

For each NDVI image record, we can render a color-coded overlay:

```
NDVI Value → Color Mapping:
  0.0 - 0.1  → Brown   (bare soil)
  0.1 - 0.3  → Yellow  (sparse vegetation)
  0.3 - 0.5  → Light Green
  0.5 - 0.7  → Green   (healthy)
  0.7 - 1.0  → Dark Green (very healthy)
```

---

## ⚙️ Phase 3 — Satellite Image Pipeline (Backend)

### 3.1 Data Flow

```
User registers land
        ↓
Pipeline triggered (background task)
        ↓
Fetch Sentinel-2 data via STAC API
  (Microsoft Planetary Computer — FREE)
        ↓
Download bands: B02, B03, B04, B08
        ↓
Generate:
  1. True Color composite (B04, B03, B02) → PNG
  2. NDVI heatmap ((B08-B04)/(B08+B04)) → PNG
        ↓
Save to: data/images/land_{id}/
  - land_1_20260315_true_color.png
  - land_1_20260315_ndvi.png
        ↓
Insert record into land_images table
        ↓
Serve via: GET /api/v1/images/{filename}
        ↓
Frontend displays in satellite viewer
```

### 3.2 File Storage Structure

```
data/
  images/
    land_1/
      20260215_true_color.png
      20260215_ndvi.png
      20260302_true_color.png
      20260302_ndvi.png
      ...
    land_2/
      ...
```

### 3.3 Backend Image Serving Endpoint (New)

```python
# Add to app/api/lands.py or app/api/images.py
from fastapi.responses import FileResponse

@router.get("/images/{land_id}/{filename}")
def serve_land_image(land_id: int, filename: str):
    path = f"/data/images/land_{land_id}/{filename}"
    return FileResponse(path, media_type="image/png")
```

---

## 📋 Implementation Order

### Sprint 1 — Map Drawing (2-3 hours)
1. `npm install leaflet react-leaflet leaflet-draw`
2. Import Leaflet CSS in `main.jsx`
3. Create `MapDrawComponent.jsx`
4. Wire into `AddLandPage.jsx`
5. Submit GeoJSON to existing `/lands/discover` endpoint
6. Show "Analyzing..." loading state → redirect to land details

### Sprint 2 — Read-Only Map on Land Details (1-2 hours)
1. Create `MapViewComponent.jsx`
2. Show satellite base tiles (Esri free)
3. Overlay land boundary polygon from `boundary_polygon` field
4. Add centroid marker
5. Replace current placeholder in `LandDetailsPage.jsx`

### Sprint 3 — Satellite Image Pipeline (4-6 hours)
1. Add STAC API client to backend (`app/ingestion/sentinel.py`)
2. Download and process Sentinel-2 bands
3. Generate True Color + NDVI PNG files
4. Store in `data/images/land_{id}/`
5. Add static file serving endpoint
6. Update `land_images` records with real paths
7. Frontend image gallery loads actual images

---

## 🔧 Technical Notes

### Leaflet Marker Icon Fix (Common Issue)
```javascript
// Fix missing marker icons in webpack/vite
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
```

### Vite Configuration
No special config needed — Leaflet works out of the box with Vite.

### Responsive Map
```css
.map-container {
  width: 100%;
  height: 500px;            /* desktop */
  border-radius: var(--radius-lg);
  overflow: hidden;
}

@media (max-width: 768px) {
  .map-container {
    height: 350px;           /* mobile */
  }
}
```

---

## 🚫 What NOT To Do

| ❌ Don't | ✅ Do Instead |
|---|---|
| Build custom drawing tools | Use `leaflet-draw` plugin |
| Calculate geometry on frontend | Let backend compute area/centroid |
| Use Google Maps (paid, overkill) | Use Leaflet + OpenStreetMap (free) |
| Build a GIS system | Just store GeoJSON coordinates |
| Support multi-polygons now | Start with single polygon only |
| Show raw GeoTIFF in browser | Convert to PNG on backend first |

---

## 🗺️ Map Tile Providers (All FREE)

| Provider | Type | URL Pattern |
|---|---|---|
| OpenStreetMap | Street map | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Esri World Imagery | Satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |
| CartoDB Dark | Dark theme | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |
| Esri World Topo | Topographic | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}` |

---

## 📐 Design System Integration

The map components must follow the established design system:

- **Border radius:** `var(--radius-lg)` on map containers
- **Shadows:** `var(--shadow-lg)` for floating controls
- **Colors:** Draw toolbar uses `var(--green-500)` for polygon fill
- **Animations:** `anim-fade-in` on map load
- **Typography:** Map labels use `var(--font-sans)` (Inter)
- **Dark theme ready:** Leaflet tile filter for future dark mode
