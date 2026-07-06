/**
 * components/map/MapDrawComponent.jsx
 * ------------------------------------
 * Interactive Leaflet map with polygon/circle/rectangle drawing tools.
 *
 * Props:
 *   onGeometryChange(geojson, stats) — called when user draws/edits/deletes a shape
 *     geojson: { type: "Polygon", coordinates: [...] } or null if deleted
 *     stats: { center: [lat, lng], areaApprox: number (hectares), vertexCount: number }
 *
 * Follows: documents/Frontend/07_UI_UX_Style_Guide.md
 * Plan:    documents/Frontend/08_Map_and_Satellite_Integration_Plan.md
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "./Map.css";

/* ── Fix Leaflet default marker icons (Vite asset issue) ─────────── */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/* ── Constants ──────────────────────────────────────────────────── */
const EGYPT_CENTER = [26.8, 30.8];
const EGYPT_ZOOM = 7;

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
  },
};

/* Draw style matching the design system green */
const DRAW_SHAPE_OPTS = {
  color: "#22c55e",
  fillColor: "#22c55e",
  fillOpacity: 0.15,
  weight: 2.5,
  dashArray: "6, 4",
};

/* ── Geometry Helpers ───────────────────────────────────────────── */

/** Approximate area in hectares using Shoelace formula */
function computeAreaHectares(latLngs) {
  if (!latLngs || latLngs.length < 3) return 0;
  // Use leaflet-draw's geodesicArea if available
  if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
    return L.GeometryUtil.geodesicArea(latLngs) / 10000;
  }
  // Fallback: Shoelace on projected coords
  let area = 0;
  for (let i = 0; i < latLngs.length; i++) {
    const j = (i + 1) % latLngs.length;
    area += latLngs[i].lng * latLngs[j].lat;
    area -= latLngs[j].lng * latLngs[i].lat;
  }
  area = Math.abs(area) / 2;
  const m2 = area * 111320 * 111320 * Math.cos((latLngs[0].lat * Math.PI) / 180);
  return m2 / 10000;
}

/** Convert circle to GeoJSON polygon (32 vertices) */
function circleToGeoJSON(center, radiusMeters, numPoints = 32) {
  const coords = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const lat = center.lat + dy / 111320;
    const lng = center.lng + dx / (111320 * Math.cos((center.lat * Math.PI) / 180));
    coords.push([lng, lat]);
  }
  coords.push(coords[0]);
  return { type: "Polygon", coordinates: [coords] };
}

/** Convert Leaflet polygon LatLngs to GeoJSON */
function polygonToGeoJSON(latLngs) {
  const coords = latLngs.map((ll) => [ll.lng, ll.lat]);
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push([...coords[0]]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function regularPolygonLatLngs(center, radiusMeters, sides = 6) {
  const latLngs = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i / sides) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    latLngs.push(
      L.latLng(
        center.lat + dy / 111320,
        center.lng + dx / (111320 * Math.cos((center.lat * Math.PI) / 180))
      )
    );
  }
  return latLngs;
}

function squareLatLngs(map, start, current) {
  const startPoint = map.latLngToLayerPoint(start);
  const currentPoint = map.latLngToLayerPoint(current);
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const signedX = dx < 0 ? -side : side;
  const signedY = dy < 0 ? -side : side;
  return [
    map.layerPointToLatLng(startPoint),
    map.layerPointToLatLng(L.point(startPoint.x + signedX, startPoint.y)),
    map.layerPointToLatLng(L.point(startPoint.x + signedX, startPoint.y + signedY)),
    map.layerPointToLatLng(L.point(startPoint.x, startPoint.y + signedY)),
  ];
}

/** Extract geojson + stats from a drawn layer */
function extractFromLayer(layer, layerType) {
  if (layerType === "circle") {
    const center = layer.getLatLng();
    const radius = layer.getRadius();
    return {
      geojson: circleToGeoJSON(center, radius),
      stats: {
        center: [center.lat, center.lng],
        areaApprox: Math.round((Math.PI * radius * radius) / 100) / 100,
        vertexCount: 32,
      },
    };
  }
  const latLngs = layer.getLatLngs()[0];
  const center = layer.getBounds().getCenter();
  return {
    geojson: polygonToGeoJSON(latLngs),
    stats: {
      center: [center.lat, center.lng],
      areaApprox: Math.round(computeAreaHectares(latLngs) * 100) / 100,
      vertexCount: latLngs.length,
    },
  };
}


/* ═══════════════════════════════════════════════════════════════ */
/*  MapDrawComponent                                              */
/* ═══════════════════════════════════════════════════════════════ */

export default function MapDrawComponent({ onGeometryChange }) {
  const mapElRef = useRef(null);          // DOM element
  const mapObjRef = useRef(null);         // L.map instance
  const drawnItemsRef = useRef(null);     // FeatureGroup
  const tileRef = useRef(null);           // Current tile layer
  const callbackRef = useRef(onGeometryChange); // Stable callback ref
  const wrapperRef = useRef(null);        // Outer wrapper for fullscreen
  const customDrawRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState("satellite");
  const [hasShape, setHasShape] = useState(false);
  const [shapeStats, setShapeStats] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawHint, setDrawHint] = useState(null);

  // Keep callback ref up to date without re-creating effects
  useEffect(() => {
    callbackRef.current = onGeometryChange;
  }, [onGeometryChange]);

  /** Stable emit — never changes, uses refs only */
  const emitGeometry = useCallback((geojson, stats) => {
    setHasShape(!!geojson);
    setShapeStats(geojson ? stats : null);
    if (callbackRef.current) callbackRef.current(geojson, stats);
  }, []);

  const stopCustomDraw = useCallback(() => {
    const cleanup = customDrawRef.current;
    if (cleanup) cleanup();
    customDrawRef.current = null;
    setDrawHint(null);
    const map = mapObjRef.current;
    if (map) {
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    }
  }, []);

  const replaceShape = useCallback((layer, layerType = "polygon") => {
    if (!drawnItemsRef.current || !mapObjRef.current) return;
    drawnItemsRef.current.clearLayers();
    drawnItemsRef.current.addLayer(layer);
    const { geojson, stats } = extractFromLayer(layer, layerType);
    emitGeometry(geojson, stats);
    requestAnimationFrame(() => {
      mapObjRef.current?.invalidateSize({ animate: false });
    });
  }, [emitGeometry]);

  /* ── Initialize Leaflet map (runs once) ─────────────────────── */
  useEffect(() => {
    if (mapObjRef.current) return;

    const map = L.map(mapElRef.current, {
      center: EGYPT_CENTER,
      zoom: EGYPT_ZOOM,
      zoomControl: false, // we'll add custom position
      maxZoom: 19, // Prevent zooming into empty grey areas
    });

    // Zoom control top-right to avoid collision with draw toolbar
    L.control.zoom({ position: "topright" }).addTo(map);

    // Tile layer
    const tile = L.tileLayer(TILE_LAYERS.satellite.url, {
      attribution: TILE_LAYERS.satellite.attribution,
      maxZoom: 19,
    }).addTo(map);
    tileRef.current = tile;

    // Feature group for drawn shapes
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Draw controls
    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: DRAW_SHAPE_OPTS,
        },
        rectangle: {
          shapeOptions: DRAW_SHAPE_OPTS,
        },
        circle: {
          shapeOptions: DRAW_SHAPE_OPTS,
        },
        polyline: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });
    map.addControl(drawControl);

    /* ── Draw events ──────────────────────────────────────────── */
    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      const { geojson, stats } = extractFromLayer(e.layer, e.layerType);
      
      // Prevent tiny accidental shapes (like single-click rectangles)
      if (stats.areaApprox < 0.001) {
        setDrawHint("Shape too small. Please click and drag to create a larger area.");
        emitGeometry(null, null);
        return;
      }
      
      drawnItems.addLayer(e.layer);
      emitGeometry(geojson, stats);
      setDrawHint(null);

      // Force Leaflet to recalculate container size after React state update
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      e.layers.eachLayer((layer) => {
        const isCircle = layer instanceof L.Circle;
        const { geojson, stats } = extractFromLayer(layer, isCircle ? "circle" : "polygon");
        emitGeometry(geojson, stats);
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      emitGeometry(null, null);
    });

    mapObjRef.current = map;

    // Fix: invalidate size after first render (ensures tiles load fully)
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      stopCustomDraw();
      map.remove();
      mapObjRef.current = null;
    };
  }, [emitGeometry, stopCustomDraw]);

  /* ── Invalidate map size whenever fullscreen changes ────────── */
  useEffect(() => {
    if (mapObjRef.current) {
      // Small delay for CSS transition to complete
      const timer = setTimeout(() => {
        mapObjRef.current.invalidateSize({ animate: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  /* ── Switch tile layer ─────────────────────────────────────── */
  const switchLayer = useCallback((layerKey) => {
    if (!mapObjRef.current || !tileRef.current) return;
    setActiveLayer(layerKey);
    tileRef.current.setUrl(TILE_LAYERS[layerKey].url);
  }, []);

  /* ── Clear drawn shape ──────────────────────────────────────── */
  const clearShape = useCallback(() => {
    stopCustomDraw();
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    emitGeometry(null, null);
  }, [emitGeometry, stopCustomDraw]);

  /* ── Draw Wrappers ─────────────────────────────────────────── */
  const startDrawPolygon = useCallback(() => {
    if (!mapObjRef.current) return;
    new L.Draw.Polygon(mapObjRef.current, {
      allowIntersection: false,
      showArea: true,
      shapeOptions: DRAW_SHAPE_OPTS,
    }).enable();
    setDrawHint("Click map to draw a custom polygon boundary");
  }, []);

  const startDrawRectangle = useCallback(() => {
    const map = mapObjRef.current;
    if (!map) return;

    stopCustomDraw();
    setDrawHint("Click the center and drag outward to draw a rectangle");
    map.dragging.disable();
    map.getContainer().style.cursor = "crosshair";

    let centerLatLng = null;
    let previewLayer = null;

    const onMouseDown = (e) => {
      if (e.originalEvent && e.originalEvent.button === 2) return;
      centerLatLng = e.latlng;
      previewLayer = L.rectangle(
        [centerLatLng, centerLatLng],
        DRAW_SHAPE_OPTS
      ).addTo(map);
    };

    const onMouseMove = (e) => {
      if (!centerLatLng || !previewLayer) return;
      const current = e.latlng;
      const dy = Math.abs(current.lat - centerLatLng.lat);
      const dx = Math.abs(current.lng - centerLatLng.lng);
      
      const bounds = L.latLngBounds(
        [centerLatLng.lat - dy, centerLatLng.lng - dx],
        [centerLatLng.lat + dy, centerLatLng.lng + dx]
      );
      previewLayer.setBounds(bounds);
    };

    const onMouseUp = (e) => {
      if (!centerLatLng || !previewLayer) return;
      
      const current = e.latlng;
      const dy = Math.abs(current.lat - centerLatLng.lat);
      const dx = Math.abs(current.lng - centerLatLng.lng);
      
      const bounds = L.latLngBounds(
        [centerLatLng.lat - dy, centerLatLng.lng - dx],
        [centerLatLng.lat + dy, centerLatLng.lng + dx]
      );
      
      map.removeLayer(previewLayer);
      
      const poly = L.rectangle(bounds, DRAW_SHAPE_OPTS);
      const { geojson, stats } = extractFromLayer(poly, "polygon");
      
      stopCustomDraw();

      if (stats.areaApprox < 0.001) {
        setDrawHint("Shape too small. Please click and drag to create a larger area.");
        emitGeometry(null, null);
        return;
      }

      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
        drawnItemsRef.current.addLayer(poly);
      }
      emitGeometry(geojson, stats);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    customDrawRef.current = () => {
      if (previewLayer) map.removeLayer(previewLayer);
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    };
  }, [emitGeometry, stopCustomDraw]);

  const startDrawCircle = useCallback(() => {
    if (!mapObjRef.current) return;
    new L.Draw.Circle(mapObjRef.current, {
      shapeOptions: DRAW_SHAPE_OPTS,
    }).enable();
    setDrawHint("Click and drag to draw a circular boundary");
  }, []);

  /* ── Toggle fullscreen ──────────────────────────────────────── */
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  /* ── ESC key exits fullscreen ───────────────────────────────── */
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  return (
    <div
      ref={wrapperRef}
      className={`map-draw-wrapper${isFullscreen ? " map-draw-wrapper--fullscreen" : ""}`}
    >
      {/* ── Top toolbar: layer switcher + fullscreen ─────────── */}
      <div className="map-top-controls">
        <div className="map-toolbar">
          <button
            type="button"
            className={`map-toolbar__btn${activeLayer === "satellite" ? " map-toolbar__btn--active" : ""}`}
            onClick={() => switchLayer("satellite")}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            className={`map-toolbar__btn${activeLayer === "street" ? " map-toolbar__btn--active" : ""}`}
            onClick={() => switchLayer("street")}
          >
            🗺️ Street
          </button>
        </div>
        <div className="map-toolbar">
          <button
            type="button"
            className="map-toolbar__btn map-toolbar__btn--draw"
            onClick={startDrawPolygon}
            title="Draw Polygon Boundary"
          >
            <span style={{ fontSize: 16 }}>⬠</span> Polygon
          </button>
          <button
            type="button"
            className="map-toolbar__btn map-toolbar__btn--draw"
            onClick={startDrawRectangle}
            title="Draw Rectangular Boundary"
          >
            <span style={{ fontSize: 16 }}>⬛</span> Rectangle
          </button>
          <button
            type="button"
            className="map-toolbar__btn map-toolbar__btn--draw"
            onClick={startDrawCircle}
            title="Draw Circular Boundary"
          >
            <span style={{ fontSize: 16 }}>⭕</span> Circle
          </button>
        </div>
        <button
          type="button"
          className="map-toolbar__btn map-fullscreen-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Map container (NEVER changes className to avoid Leaflet issues) ── */}
      <div ref={mapElRef} className="map-container" />

      {/* ── Instructions overlay (pointer-events: none, won't interfere) ── */}
      {!hasShape && (
        <div className="map-instructions" key="instructions">
          <svg className="map-instructions__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6l9-4 9 4" />
            <path d="M3 6v12l9 4 9-4V6" />
            <path d="M12 22V10" />
          </svg>
          <div className="map-instructions__text">
            {drawHint || "Use the draw tools to mark your land"}
          </div>
          <div className="map-instructions__sub">
            Polygon • Rectangle • Circle
          </div>
        </div>
      )}

      {/* ── Bottom info panel ─────────────────────────────────── */}
      {hasShape && shapeStats && (
        <div className="map-info-panel" key="info-panel">
          <div className="map-info-panel__stats">
            <div className="map-info-panel__stat">
              <span className="map-info-panel__stat-value">{shapeStats.areaApprox} ha</span>
              <span className="map-info-panel__stat-label">Area (approx)</span>
            </div>
            <div className="map-info-panel__stat">
              <span className="map-info-panel__stat-value">{shapeStats.center[0].toFixed(4)}°N</span>
              <span className="map-info-panel__stat-label">Latitude</span>
            </div>
            <div className="map-info-panel__stat">
              <span className="map-info-panel__stat-value">{shapeStats.center[1].toFixed(4)}°E</span>
              <span className="map-info-panel__stat-label">Longitude</span>
            </div>
            <div className="map-info-panel__stat">
              <span className="map-info-panel__stat-value">{shapeStats.vertexCount}</span>
              <span className="map-info-panel__stat-label">Vertices</span>
            </div>
          </div>
          <div className="map-info-panel__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearShape}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
