/**
 * components/map/MapDrawComponent.jsx
 * Interactive Leaflet map with polygon/circle/rectangle drawing tools.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import "./Map.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

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

const DRAW_SHAPE_OPTS = {
  color: "#22c55e",
  fillColor: "#22c55e",
  fillOpacity: 0.15,
  weight: 2.5,
  dashArray: "6, 4",
};

function computeAreaHectares(latLngs) {
  if (!latLngs || latLngs.length < 3) return 0;
  if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
    return L.GeometryUtil.geodesicArea(latLngs) / 10000;
  }
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

function FullscreenIcon({ exit }) {
  if (exit) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export default function MapDrawComponent({ onGeometryChange, onFullscreenChange }) {
  const { isMobile, isDrawer } = useBreakpoint();
  const isCompactUI = isDrawer;

  const mapElRef = useRef(null);
  const mapObjRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const tileRef = useRef(null);
  const callbackRef = useRef(onGeometryChange);
  const activeDrawRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState("satellite");
  const [hasShape, setHasShape] = useState(false);
  const [shapeStats, setShapeStats] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawHint, setDrawHint] = useState(null);
  const [activeTool, setActiveTool] = useState(null);

  useEffect(() => {
    callbackRef.current = onGeometryChange;
  }, [onGeometryChange]);

  const emitGeometry = useCallback((geojson, stats) => {
    setHasShape(!!geojson);
    setShapeStats(geojson ? stats : null);
    if (callbackRef.current) callbackRef.current(geojson, stats);
  }, []);

  const stopActiveDraw = useCallback(() => {
    if (activeDrawRef.current) {
      try {
        activeDrawRef.current.disable();
      } catch {
        // already disabled
      }
      activeDrawRef.current = null;
    }
    setActiveTool(null);
    setDrawHint(null);
    const map = mapObjRef.current;
    if (map) {
      map.dragging.enable();
      map.getContainer().style.cursor = "";
    }
  }, []);

  const commitLayer = useCallback((layer, layerType) => {
    if (!drawnItemsRef.current) return false;
    const { geojson, stats } = extractFromLayer(layer, layerType);

    if (stats.areaApprox < 0.001) {
      setDrawHint("Shape too small — zoom in and draw a larger area.");
      emitGeometry(null, null);
      return false;
    }

    drawnItemsRef.current.clearLayers();
    drawnItemsRef.current.addLayer(layer);
    emitGeometry(geojson, stats);
    setDrawHint(null);
    requestAnimationFrame(() => {
      mapObjRef.current?.invalidateSize({ animate: false });
    });
    return true;
  }, [emitGeometry]);

  useEffect(() => {
    if (mapObjRef.current) return;

    const map = L.map(mapElRef.current, {
      center: EGYPT_CENTER,
      zoom: EGYPT_ZOOM,
      zoomControl: false,
      maxZoom: 19,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    const tile = L.tileLayer(TILE_LAYERS.satellite.url, {
      attribution: TILE_LAYERS.satellite.attribution,
      maxZoom: 19,
    }).addTo(map);
    tileRef.current = tile;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: { allowIntersection: false, showArea: true, shapeOptions: DRAW_SHAPE_OPTS },
        rectangle: { shapeOptions: DRAW_SHAPE_OPTS },
        circle: { shapeOptions: DRAW_SHAPE_OPTS },
        polyline: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      stopActiveDraw();
      commitLayer(e.layer, e.layerType);
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      e.layers.eachLayer((layer) => {
        const isCircle = layer instanceof L.Circle;
        commitLayer(layer, isCircle ? "circle" : "polygon");
      });
    });

    map.on(L.Draw.Event.DELETED, () => {
      emitGeometry(null, null);
    });

    mapObjRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      stopActiveDraw();
      map.remove();
      mapObjRef.current = null;
    };
  }, [commitLayer, emitGeometry, stopActiveDraw]);

  useEffect(() => {
    if (!mapObjRef.current) return;
    const map = mapObjRef.current;
    const refresh = () => map.invalidateSize({ animate: false });
    const t1 = setTimeout(refresh, isFullscreen ? 80 : 30);
    const t2 = setTimeout(refresh, isFullscreen ? 240 : 120);
    const t3 = setTimeout(refresh, isFullscreen ? 480 : 0);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen, isCompactUI]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add("map-draw-body-lock");
    } else {
      document.body.classList.remove("map-draw-body-lock");
    }

    const handleKey = (e) => {
      if (e.key === "Escape") {
        stopActiveDraw();
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) document.addEventListener("keydown", handleKey);

    const timer = setTimeout(() => mapObjRef.current?.invalidateSize({ animate: false }), 200);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isFullscreen, stopActiveDraw]);

  useEffect(() => () => {
    document.body.classList.remove("map-draw-body-lock");
  }, []);

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  const switchLayer = useCallback((layerKey) => {
    if (!tileRef.current) return;
    setActiveLayer(layerKey);
    tileRef.current.setUrl(TILE_LAYERS[layerKey].url);
  }, []);

  const clearShape = useCallback(() => {
    stopActiveDraw();
    drawnItemsRef.current?.clearLayers();
    emitGeometry(null, null);
  }, [emitGeometry, stopActiveDraw]);

  const startDraw = useCallback((tool) => {
    const map = mapObjRef.current;
    if (!map) return;

    stopActiveDraw();

    let handler = null;
    let hint = "";

    if (tool === "polygon") {
      handler = new L.Draw.Polygon(map, {
        allowIntersection: false,
        showArea: true,
        shapeOptions: DRAW_SHAPE_OPTS,
      });
      hint = isMobile
        ? "Tap each corner, then tap the first point to finish"
        : "Click each corner, then click the first point to close";
    } else if (tool === "rectangle") {
      handler = new L.Draw.Rectangle(map, { shapeOptions: DRAW_SHAPE_OPTS });
      hint = isMobile
        ? "Touch and drag to draw a rectangle"
        : "Click and drag to draw a rectangle";
    } else if (tool === "circle") {
      handler = new L.Draw.Circle(map, { shapeOptions: DRAW_SHAPE_OPTS });
      hint = isMobile
        ? "Touch center and drag outward for a circle"
        : "Click center and drag outward for a circle";
    }

    if (!handler) return;
    handler.enable();
    activeDrawRef.current = handler;
    setActiveTool(tool);
    setDrawHint(hint);
  }, [isMobile, stopActiveDraw]);

  const enterFullscreen = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setIsFullscreen(true);
  }, []);

  const exitFullscreen = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    stopActiveDraw();
    setIsFullscreen(false);
  }, [stopActiveDraw]);

  const toggleFullscreen = useCallback((e) => {
    if (isFullscreen) exitFullscreen(e);
    else enterFullscreen(e);
  }, [enterFullscreen, exitFullscreen, isFullscreen]);

  const wrapperClass = [
    "map-draw-wrapper",
    isCompactUI ? "map-draw-wrapper--compact" : "",
    isFullscreen ? "map-draw-wrapper--fullscreen" : "",
  ].filter(Boolean).join(" ");

  const drawTools = [
    { key: "polygon", label: "Polygon", icon: "⬠" },
    { key: "rectangle", label: "Rectangle", icon: "▭" },
    { key: "circle", label: "Circle", icon: "◯" },
  ];

  const mapUI = (
    <div className={wrapperClass}>
      {isFullscreen && (
        <div className="map-fullscreen-chrome">
          <div className="map-fullscreen-topbar">
            <button
              type="button"
              className="map-fullscreen-topbar__back"
              onClick={exitFullscreen}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Exit fullscreen map"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <span className="map-fullscreen-topbar__title">Draw boundary</span>
            {isCompactUI ? (
              <button
                type="button"
                className="map-fullscreen-topbar__close"
                onClick={exitFullscreen}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close fullscreen map"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="map-fullscreen-topbar__done"
                onClick={exitFullscreen}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Done
              </button>
            )}
          </div>
          {isCompactUI ? (
            <div className="map-fullscreen-topbar__layers">
              <button
                type="button"
                className={`map-mobile-pill${activeLayer === "satellite" ? " map-mobile-pill--active" : ""}`}
                onClick={() => switchLayer("satellite")}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Satellite
              </button>
              <button
                type="button"
                className={`map-mobile-pill${activeLayer === "street" ? " map-mobile-pill--active" : ""}`}
                onClick={() => switchLayer("street")}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Street
              </button>
            </div>
          ) : (
            <div className="map-fullscreen-toolbar">
              <div className="map-toolbar">
                <button
                  type="button"
                  className={`map-toolbar__btn${activeLayer === "satellite" ? " map-toolbar__btn--active" : ""}`}
                  onClick={() => switchLayer("satellite")}
                >
                  Satellite
                </button>
                <button
                  type="button"
                  className={`map-toolbar__btn${activeLayer === "street" ? " map-toolbar__btn--active" : ""}`}
                  onClick={() => switchLayer("street")}
                >
                  Street
                </button>
              </div>
              <div className="map-toolbar map-fullscreen-toolbar__draw">
                {drawTools.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    className={`map-toolbar__btn map-toolbar__btn--draw${activeTool === tool.key ? " map-toolbar__btn--active" : ""}`}
                    onClick={() => startDraw(tool.key)}
                  >
                    <span aria-hidden="true">{tool.icon}</span> {tool.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Desktop inline toolbar (hidden in fullscreen) */}
      {!isCompactUI && !isFullscreen && (
        <div className="map-top-controls map-top-controls--desktop">
          <div className="map-toolbar">
            <button
              type="button"
              className={`map-toolbar__btn${activeLayer === "satellite" ? " map-toolbar__btn--active" : ""}`}
              onClick={() => switchLayer("satellite")}
            >
              Satellite
            </button>
            <button
              type="button"
              className={`map-toolbar__btn${activeLayer === "street" ? " map-toolbar__btn--active" : ""}`}
              onClick={() => switchLayer("street")}
            >
              Street
            </button>
          </div>
          <div className="map-toolbar">
            {drawTools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className={`map-toolbar__btn map-toolbar__btn--draw${activeTool === tool.key ? " map-toolbar__btn--active" : ""}`}
                onClick={() => startDraw(tool.key)}
              >
                <span aria-hidden="true">{tool.icon}</span> {tool.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="map-toolbar__btn map-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <FullscreenIcon exit={isFullscreen} />
          </button>
        </div>
      )}

      {/* Mobile compact header */}
      {isCompactUI && !isFullscreen && (
        <div className="map-mobile-header">
          <div className="map-mobile-header__layers">
            <button
              type="button"
              className={`map-mobile-pill${activeLayer === "satellite" ? " map-mobile-pill--active" : ""}`}
              onClick={() => switchLayer("satellite")}
            >
              Satellite
            </button>
            <button
              type="button"
              className={`map-mobile-pill${activeLayer === "street" ? " map-mobile-pill--active" : ""}`}
              onClick={() => switchLayer("street")}
            >
              Street
            </button>
          </div>
          <button
            type="button"
            className="map-mobile-expand-btn"
            onClick={enterFullscreen}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Expand map to fullscreen"
          >
            <FullscreenIcon exit={false} />
            <span>Expand</span>
          </button>
        </div>
      )}

      <div className="map-draw-canvas">
        <div ref={mapElRef} className="map-container" />

        {!hasShape && (
          <div className="map-instructions">
            <svg className="map-instructions__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6l9-4 9 4" />
              <path d="M3 6v12l9 4 9-4V6" />
            </svg>
            <div className="map-instructions__text">
              {drawHint || (isCompactUI ? "Choose a draw tool below" : "Use the draw tools to mark your land")}
            </div>
            {!drawHint && (
              <div className="map-instructions__sub">Polygon · Rectangle · Circle</div>
            )}
          </div>
        )}

        {hasShape && shapeStats && (
          <div className="map-info-panel">
            <div className="map-info-panel__stats">
              <div className="map-info-panel__stat">
                <span className="map-info-panel__stat-value">{shapeStats.areaApprox} ha</span>
                <span className="map-info-panel__stat-label">Area</span>
              </div>
              <div className="map-info-panel__stat">
                <span className="map-info-panel__stat-value">{shapeStats.center[0].toFixed(3)}°N</span>
                <span className="map-info-panel__stat-label">Lat</span>
              </div>
              <div className="map-info-panel__stat">
                <span className="map-info-panel__stat-value">{shapeStats.center[1].toFixed(3)}°E</span>
                <span className="map-info-panel__stat-label">Lng</span>
              </div>
            </div>
            <div className="map-info-panel__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={clearShape}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom draw dock */}
      {isCompactUI && (
        <div className={`map-draw-dock${isFullscreen ? " map-draw-dock--fullscreen" : ""}`}>
          {drawTools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              className={`map-draw-dock__btn${activeTool === tool.key ? " map-draw-dock__btn--active" : ""}`}
              onClick={() => startDraw(tool.key)}
            >
              <span className="map-draw-dock__icon" aria-hidden="true">{tool.icon}</span>
              <span className="map-draw-dock__label">{tool.label}</span>
            </button>
          ))}
        </div>
      )}

    </div>
  );

  return mapUI;
}