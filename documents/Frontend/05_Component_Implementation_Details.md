# Component Implementation Details

This document outlines the implementation strategy for the most complex frontend components.

## 1. Map System (`components/map`)

### `MapContainer`
- **Library:** `react-leaflet` wrapping Leaflet.js.
- **Base Layer:** OpenStreetMap tile layer.
- **Behavior:** Needs to cover the full viewport or a substantial container height. Should handle responsive resizing.

### `PolygonDrawer`
- **Library:** `leaflet-draw` or `@edit/leaflet` for drawing polygons.
- **Integration:** When a user completes drawing a polygon, the coordinates must be extracted as a GeoJSON Feature and stored in the local component state before being submitted.

## 2. Satellite Viewer (`components/satellite/SatelliteViewer`)

### Layer Toggling
The viewer must support switching between:
- **True Color:** Standard RGB satellite image.
- **NDVI:** The computed vegetation index image.
- **Base Map:** The underlying OpenStreetMap.

*Implementation Note:* The backend provides standard image URLs. The viewer is responsible for rendering an `<img />` tag absolute positioned over the map or within an image frame, updating the `src` attribute when the user toggles the layer type.

### `TimelineSlider`
- A range slider (or stepped slider from `shadcn/ui`) representing different dates.
- Changing the slider value triggers a state update (`selectedDate`), which in turn updates the visible image in the `SatelliteViewer` and the data points in the Analytics Charts.

## 3. Intelligence Feed (`features/dashboard/IntelligenceFeed`)

- Should be rendered as a vertical list of alerts/insights.
- Differentiate urgency by color (e.g., Red/Border-Red for Water Stress, Green/Border-Green for Growth Improving).
- Each item should ideally be clickable, routing the user to the specific `/lands/:id` that the insight pertains to.

## 4. Analytics Charts (`components/charts`)

- **Library:** `Recharts` is highly recommended for React.
- **NDVIChart:** A LineChart tracking NDVI values over time. Must synchronize its active tooltip or highlight with the `TimelineSlider` position.
- **ClimateChart:** A dual-axis chart comparing Temperature (Line) and Rainfall (Bar).
