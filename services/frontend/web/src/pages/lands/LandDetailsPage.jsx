/**
 * pages/lands/LandDetailsPage.jsx
 * --------------------------------
 * Main intelligence page for a single land.
 * Fetches ALL data from the backend API:
 *   - Land detail (name, coordinates, area, status)
 *   - Climate time-series
 *   - Crop NDVI time-series + health + harvest prediction
 *   - Soil data
 *   - Satellite images
 *   - Water data
 *   - Alerts (from analytics)
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getLandDetail,
  getLandTimeseries,
  getLandImages,
  getCropHealth,
  getHarvestPrediction,
  getCropZones,
  reanalyzeLand,
  updateLandSettings,
} from "../../services/api";
import MapViewComponent from "../../components/map/MapViewComponent";
import "../Lands.css";

export default function LandDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [land, setLand] = useState(null);
  const [climate, setClimate] = useState([]);
  const [crops, setCrops] = useState([]);
  const [soil, setSoil] = useState([]);
  const [water, setWater] = useState([]);
  const [images, setImages] = useState([]);
  const [cropHealth, setCropHealth] = useState(null);
  const [harvest, setHarvest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLayer, setActiveLayer] = useState("true_color");
  const [cropZones, setCropZones] = useState([]);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [intervalDays, setIntervalDays] = useState(16);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all data in parallel
        const [landRes, climateRes, cropsRes, soilRes, waterRes, imagesRes, zonesRes] =
          await Promise.all([
            getLandDetail(id),
            getLandTimeseries(id, "climate").catch(() => ({ points: [] })),
            getLandTimeseries(id, "crops").catch(() => ({ points: [] })),
            getLandTimeseries(id, "soil").catch(() => ({ points: [] })),
            getLandTimeseries(id, "water").catch(() => ({ points: [] })),
            getLandImages(id).catch(() => ({ images: [] })),
            getCropZones(id).catch(() => ({ zones: [] })),
          ]);

        setLand(landRes);
        setClimate(climateRes.points || []);
        setCrops(cropsRes.points || []);
        setSoil(soilRes.points || []);
        setWater(waterRes.points || []);
        setImages(imagesRes.images || []);
        setCropZones(zonesRes.zones || []);

        // Fetch crop intelligence (non-blocking)
        getCropHealth(id)
          .then((r) => setCropHealth(r))
          .catch(() => { });
        getHarvestPrediction(id)
          .then((r) => setHarvest(r))
          .catch(() => { });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  const layers = [
    { key: "true_color", label: "True Color" },
    { key: "ndvi", label: "NDVI" },
  ];

  /* ---------- Re-Analyze handler ---------- */
  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      await reanalyzeLand(id);
      // Wait for backend to process, then reload data
      setTimeout(() => window.location.reload(), 4000);
    } catch (err) {
      setError("Re-analysis failed: " + err.message);
      setReanalyzing(false);
    }
  };

  /* ---------- Settings handler ---------- */
  const handleSaveSettings = async () => {
    try {
      await updateLandSettings(id, { monitoring_interval_days: parseInt(intervalDays) });
      setShowSettings(false);
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    }
  };

  // Get latest values
  const latestCrop = crops.length > 0 ? crops[crops.length - 1] : null;
  const latestClimate = climate.length > 0 ? climate[climate.length - 1] : null;
  const latestSoil = soil.length > 0 ? soil[soil.length - 1] : null;
  const latestWater = water.length > 0 ? water[water.length - 1] : null;

  // Filtered images by type
  const filteredImages = images.filter((img) =>
    activeLayer === "true_color"
      ? img.image_type === "true_color"
      : img.image_type === "ndvi"
  );

  // Multi-crop support: use real cropZones from the API
  const primaryZone = cropZones && cropZones.length > 0
    ? cropZones.reduce((best, z) => ((z.area_pct || z.avg_confidence) > (best.area_pct || best.avg_confidence) ? z : best), cropZones[0])
    : null;

  const primaryCropType = primaryZone
    ? primaryZone.crop_type
    : (crops.length > 0 ? crops[crops.length - 1].payload?.crop_type : null);

  const primaryCrops = crops.filter(c => c.payload?.crop_type === primaryCropType);
  if (primaryCrops.length === 0 && crops.length > 0) primaryCrops.push(...crops); // fallback

  // NDVI bar chart from primary crop only
  const ndviBars = primaryCrops.map((c) => Math.round((c.value || 0) * 100));

  if (loading) {
    return (
      <div className="anim-fade-in" style={{ padding: "var(--space-3xl)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-md)" }}>
          <div className="spinner spinner--dark spinner--lg" />
          <p className="text-body-sm">Loading land data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state anim-fade-in">
        <svg className="error-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <div className="error-state__message">{error}</div>
        <button className="btn btn--primary" onClick={() => navigate("/lands")}>
          Back to Lands
        </button>
      </div>
    );
  }

  if (!land) return null;

  const getStatusBadge = () => {
    if (land.status === "ready") return "healthy";
    if (land.status === "processing") return "warning";
    return "info";
  };

  return (
    <div className="anim-fade-in">
      <div className="land-detail">
        {/* --- Header --- */}
        <div className="land-detail__header">
          <div className="land-detail__header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate("/lands")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>
            <h1 className="land-detail__title">{land.name}</h1>
            <div className="land-detail__meta">
              <span className="land-detail__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {land.latitude.toFixed(4)}°N, {land.longitude.toFixed(4)}°E
              </span>
              <span className="land-detail__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 3v18" />
                </svg>
                {land.area_hectares} hectares
              </span>
              <span className={`badge badge--${getStatusBadge()}`}>
                <span className="badge__dot" />
                {land.status.charAt(0).toUpperCase() + land.status.slice(1)}
              </span>
            </div>
            {land.description && (
              <p className="text-body-sm" style={{ marginTop: "var(--space-sm)", maxWidth: 700 }}>
                {land.description}
              </p>
            )}
          </div>
          <div className="land-detail__header-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => setShowSettings(true)}>
              ⚙ Settings
            </button>
            <button className="btn btn--secondary btn--sm">Export Data</button>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleReanalyze}
              disabled={reanalyzing}
            >
              {reanalyzing ? "Analyzing…" : "Re-Analyze"}
            </button>
          </div>
        </div>

        {/* --- Settings Modal --- */}
        {showSettings && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowSettings(false)}>
            <div className="card" style={{ width: 420, padding: "var(--space-lg)" }} onClick={(e) => e.stopPropagation()}>
              <h2 className="text-h3" style={{ marginBottom: "var(--space-md)" }}>Land Settings</h2>
              <div className="form-group">
                <label className="form-label">Data Update Period</label>
                <select className="form-control" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)}>
                  <option value="7">Every 7 days (weekly)</option>
                  <option value="14">Every 14 days</option>
                  <option value="16">Every 16 days (Sentinel-2 default)</option>
                  <option value="30">Every 30 days (monthly)</option>
                </select>
                <span className="text-caption" style={{ marginTop: 4, display: "block" }}>
                  How often the system automatically fetches new satellite data and recomputes analytics.
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
                <button className="btn btn--ghost" onClick={() => setShowSettings(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleSaveSettings}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* --- Key Metrics (live from API) --- */}
        <div className="anim-stagger" style={{ "--stagger-index": 1 }}>
          <div className="section-header">
            <h2 className="section-header__title">Key Metrics</h2>
            <span className="text-caption">Live from backend API</span>
          </div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-card__value" style={{ color: "var(--green-600)" }}>
                {latestCrop ? latestCrop.value?.toFixed(2) : "—"}
              </div>
              <div className="metric-card__label">Current NDVI</div>
              <div className="metric-card__sub">
                {latestCrop?.payload?.growth_stage?.replace("_", " ") || "—"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card__value">
                {latestClimate ? `${latestClimate.value}°C` : "—"}
              </div>
              <div className="metric-card__label">Temperature</div>
              <div className="metric-card__sub">
                Humidity: {latestClimate?.payload?.humidity_pct || "—"}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card__value">
                {latestSoil ? `${latestSoil.value}%` : "—"}
              </div>
              <div className="metric-card__label">Soil Moisture</div>
              <div className="metric-card__sub">
                {latestSoil?.payload?.soil_type || "—"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card__value">
                {latestWater?.payload?.irrigation_status?.replace("_", " ") || "—"}
              </div>
              <div className="metric-card__label">Irrigation</div>
              <div className="metric-card__sub">
                {latestWater ? `${(latestWater.value / 1000).toFixed(0)}m³ used` : "—"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card__value">
                {primaryCropType?.split("(")[0]?.trim() || "—"}
              </div>
              <div className="metric-card__label">Primary Crop</div>
              <div className="metric-card__sub">
                Trend: {latestCrop?.payload?.ndvi_trend || "—"}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-card__value" style={{ color: harvest?.days_to_harvest <= 14 ? "var(--amber-500)" : "var(--text-primary)" }}>
                {harvest?.days_to_harvest != null ? `${harvest.days_to_harvest}d` : "—"}
              </div>
              <div className="metric-card__label">Days to Harvest</div>
              <div className="metric-card__sub">
                {harvest?.estimated_harvest_start || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* --- NDVI Progression Chart --- */}
        <div className="anim-stagger" style={{ "--stagger-index": 2 }}>
          <div className="section-header">
            <h2 className="section-header__title">
              NDVI Vegetation Index{primaryCropType ? ` — ${primaryCropType.split("(")[0].trim()}` : ""}
            </h2>
            <span className="badge badge--info">{primaryCrops.length} observations</span>
          </div>
          <div className="mini-chart" style={{ padding: "var(--space-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
              <span className="text-caption">
                {primaryCrops.length > 0 ? new Date(primaryCrops[0].timestamp).toLocaleDateString() : ""}
              </span>
              <span className="text-caption">
                {primaryCrops.length > 0 ? new Date(primaryCrops[primaryCrops.length - 1].timestamp).toLocaleDateString() : ""}
              </span>
            </div>
            <div className="mini-chart__visual" style={{ height: 160, alignItems: "flex-end" }}>
              {ndviBars.map((h, i) => (
                <div
                  key={i}
                  className="mini-chart__bar"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(0deg, ${h > 70 ? "var(--green-200), var(--green-500)" : h > 40 ? "var(--warning-border), var(--amber-500)" : "var(--error-border), var(--error)"})`,
                    borderRadius: "4px 4px 0 0",
                    flex: 1,
                    position: "relative",
                  }}
                  title={`NDVI: ${primaryCrops[i]?.value?.toFixed(2)} — ${primaryCrops[i]?.payload?.growth_stage}`}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-sm)" }}>
              {primaryCrops.map((c, i) => (
                <span
                  key={i}
                  className="text-caption"
                  style={{ flex: 1, textAlign: "center", fontSize: 10, overflow: "hidden" }}
                >
                  {c.payload?.growth_stage?.slice(0, 4) || ""}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* --- Crop Composition (multi-crop) --- */}
        {cropZones && cropZones.length > 0 && (
          <div className="anim-stagger" style={{ "--stagger-index": 2.5 }}>
            <div className="section-header">
              <h2 className="section-header__title">Crop Composition</h2>
              <span className="badge badge--info">{cropZones.length} crops detected</span>
            </div>
            <div className="insights-grid">
              {cropZones.map((zone) => {
                const isPrimary = primaryZone && zone.zone_id === primaryZone.zone_id;
                return (
                  <div className="card" key={zone.zone_id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "var(--radius-md)",
                        background: isPrimary ? "var(--green-50)" : "var(--info-light)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}>
                        {isPrimary ? "🌾" : "🌿"}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                          {zone.crop_type.split("(")[0].trim()}
                        </div>
                        <div className="text-caption">
                          {zone.area_hectares ? `${zone.area_hectares.toFixed(1)} ha • ` : ""}{zone.area_pct ? `${zone.area_pct.toFixed(1)}%` : "Secondary crop"}
                        </div>
                      </div>
                    </div>
                    {/* Confidence bar */}
                    <div style={{ marginBottom: "var(--space-sm)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span className="text-caption">Confidence</span>
                        <span className="text-caption" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {zone.avg_confidence ? (zone.avg_confidence * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 3, background: "var(--gray-100)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 3,
                          width: `${(zone.avg_confidence || 0) * 100}%`,
                          background: isPrimary
                            ? "linear-gradient(90deg, var(--green-400), var(--green-600))"
                            : "linear-gradient(90deg, var(--info), #60a5fa)",
                          transition: "width var(--transition-base)",
                        }} />
                      </div>
                    </div>
                    {/* Latest NDVI + stage */}
                    <div style={{ display: "flex", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
                      <div>
                        <div className="text-caption">Latest NDVI</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                          {zone.latest_ndvi?.toFixed(2) || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-caption">Growth Stage</div>
                        <span className={`badge badge--${isPrimary ? "healthy" : "info"}`} style={{ marginTop: 4 }}>
                          {zone.latest_growth_stage?.replace("_", " ") || "—"}
                        </span>
                      </div>
                      <div>
                        <div className="text-caption">Est. Yield</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                          {zone.estimated_yield_tons ? `${zone.estimated_yield_tons.toFixed(1)}t` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Satellite Map + Imagery --- */}
        <div className="anim-stagger" style={{ "--stagger-index": 3 }}>
          <div className="section-header">
            <h2 className="section-header__title">Satellite View</h2>
            <span className="badge badge--neutral">{images.length} captures</span>
          </div>

          {/* Real satellite map with land boundary */}
          <MapViewComponent
            latitude={land.latitude}
            longitude={land.longitude}
            boundaryPolygon={land.boundary_polygon}
            areaHectares={land.area_hectares}
            name={land.name}
          />

          {/* Image gallery below map */}
          {images.length > 0 && (
            <div className="satellite-viewer" style={{ marginTop: "var(--space-md)" }}>
              <div className="satellite-viewer__controls">
                <div className="satellite-viewer__tabs">
                  {layers.map((l) => (
                    <button
                      key={l.key}
                      className={`satellite-viewer__tab${activeLayer === l.key ? " satellite-viewer__tab--active" : ""}`}
                      onClick={() => setActiveLayer(l.key)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <span className="text-caption">
                  Sentinel-2 • {filteredImages.length} images
                </span>
              </div>
              <div style={{ padding: "var(--space-md)" }}>
                {filteredImages.length === 0 ? (
                  <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
                    <p className="text-body-sm">No {activeLayer.replace("_", " ")} images available.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-md)" }}>
                    {filteredImages.map((img, i) => (
                      <div className="card" key={img.id || i} style={{ padding: "var(--space-md)" }}>
                        {/* Real satellite image */}
                        <div style={{
                          height: 180,
                          borderRadius: "var(--radius-md)",
                          overflow: "hidden",
                          marginBottom: "var(--space-sm)",
                          position: "relative",
                          background: img.image_type === "ndvi"
                            ? "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)"
                            : "linear-gradient(135deg, #1a3a2a 0%, #142e1e 100%)",
                        }}>
                          {img.image_url ? (
                            <img
                              src={img.image_url}
                              alt={`${img.image_type === "ndvi" ? "NDVI" : "True Color"} — ${img.date}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{
                              width: "100%", height: "100%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                                {img.image_type === "ndvi" ? "🟢 NDVI" : "🛰️ True Color"}
                              </span>
                            </div>
                          )}
                          {/* Type badge on image */}
                          <div style={{
                            position: "absolute", top: 8, left: 8,
                            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                            padding: "2px 8px", borderRadius: "var(--radius-sm)",
                            fontSize: 11, fontWeight: 600, color: "#fff",
                          }}>
                            {img.image_type === "ndvi" ? "NDVI" : "True Color"}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="text-caption">{new Date(img.date).toLocaleDateString()}</div>
                            {img.ndvi_mean && (
                              <span className="badge badge--healthy" style={{ marginTop: 4 }}>
                                NDVI: {img.ndvi_mean.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <span className="text-caption">
                            ☁️ {img.cloud_cover_pct?.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- Soil Intelligence --- */}
        {soil.length > 0 && (
          <div className="anim-stagger" style={{ "--stagger-index": 4 }}>
            <div className="section-header">
              <h2 className="section-header__title">Soil Intelligence</h2>
              <span className="badge badge--neutral">{soil.length} readings</span>
            </div>
            <div className="grid-3">
              {soil.map((s, i) => (
                <div className="card" key={i}>
                  <div className="text-overline" style={{ marginBottom: "var(--space-sm)" }}>
                    {new Date(s.timestamp).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-xs)" }}>
                    {s.value}%
                  </div>
                  <div className="text-caption">Moisture</div>
                  {s.payload && (
                    <div style={{ marginTop: "var(--space-sm)", display: "flex", flexDirection: "column", gap: 4 }}>
                      {s.payload.soil_type && <span className="text-body-sm">Type: {s.payload.soil_type}</span>}
                      {s.payload.ph_level && <span className="text-body-sm">pH: {s.payload.ph_level}</span>}
                      {s.payload.organic_matter_pct && <span className="text-body-sm">Organic: {s.payload.organic_matter_pct}%</span>}
                      {s.payload.suitability_score && (
                        <span className="badge badge--healthy" style={{ marginTop: 4, alignSelf: "flex-start" }}>
                          Suitability: {s.payload.suitability_score}/100
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Crop Intelligence (per-zone health + harvest) --- */}
        {(cropHealth || harvest) && (
          <div className="anim-stagger" style={{ "--stagger-index": 5 }}>
            <div className="section-header">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <h2 className="section-header__title">Crop Intelligence</h2>
                {cropHealth && (
                  <span className={`badge badge--${cropHealth.health_score >= 70 ? "healthy" : cropHealth.health_score >= 40 ? "warning" : "critical"}`}>
                    Overall: {cropHealth.health_score}/100 • {cropHealth.health_status?.replace("_", " ")}
                  </span>
                )}
              </div>
              <span className="badge badge--info">
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}>
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3a.5.5 0 011 0v4a.5.5 0 01-1 0V4zm.5 7.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
                AI-Powered
              </span>
            </div>

            {/* Per-zone analysis cards */}
            {cropHealth?.zones?.length > 0 ? (
              cropHealth.zones.map((zh) => {
                const zhv = harvest?.zones?.find((z) => z.zone_id === zh.zone_id);
                return (
                  <div key={zh.zone_id} style={{ marginBottom: "var(--space-lg)" }}>
                    <h3 className="text-body" style={{ marginBottom: "var(--space-sm)", fontWeight: 600, fontSize: 15 }}>
                      {zh.crop_type.split("(")[0].trim()} — Zone Analysis
                    </h3>
                    <div className="insights-grid">
                      {/* Health Card */}
                      <div className="insight-card">
                        <div className="insight-card__header">
                          <div className="insight-card__icon" style={{ background: "var(--green-50)", color: "var(--green-600)" }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                          </div>
                          <span className="insight-card__title">Crop Health</span>
                        </div>
                        <div style={{ marginBottom: "var(--space-sm)" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)" }}>
                            <span style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>
                              {zh.health_score}
                            </span>
                            <span className="text-caption">/ 100</span>
                          </div>
                          <span className={`badge badge--${zh.health_score >= 70 ? "healthy" : zh.health_score >= 40 ? "warning" : "critical"}`}>
                            {zh.health_status?.replace("_", " ")}
                          </span>
                        </div>
                        <p className="insight-card__body">{zh.advice}</p>
                      </div>
                      {/* Harvest Card */}
                      {zhv && zhv.prediction_available && (
                        <div className="insight-card">
                          <div className="insight-card__header">
                            <div className="insight-card__icon" style={{ background: "var(--warning-light)", color: "var(--amber-500)" }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                            </div>
                            <span className="insight-card__title">Harvest Prediction</span>
                          </div>
                          <div style={{ marginBottom: "var(--space-sm)" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                              {zhv.estimated_harvest_start} → {zhv.estimated_harvest_end}
                            </div>
                            <span className="badge badge--info" style={{ marginTop: 4 }}>
                              {zhv.days_to_harvest} days remaining
                            </span>
                          </div>
                          <p className="insight-card__body">
                            Peak NDVI of {zhv.peak_ndvi} reached on {zhv.peak_date}.
                            Confidence: {zhv.confidence_level}.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback: single card for lands with no crop zones */
              <div className="insights-grid">
                {cropHealth && (
                  <div className="insight-card">
                    <div className="insight-card__header">
                      <div className="insight-card__icon" style={{ background: "var(--green-50)", color: "var(--green-600)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      </div>
                      <span className="insight-card__title">Crop Health</span>
                    </div>
                    <div style={{ marginBottom: "var(--space-sm)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)" }}>
                        <span style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)" }}>
                          {cropHealth.health_score}
                        </span>
                        <span className="text-caption">/ 100</span>
                      </div>
                      <span className={`badge badge--${cropHealth.health_score >= 70 ? "healthy" : cropHealth.health_score >= 40 ? "warning" : "critical"}`}>
                        {cropHealth.health_status?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="insight-card__body">{cropHealth.advice}</p>
                  </div>
                )}
                {harvest && harvest.prediction_available && (
                  <div className="insight-card">
                    <div className="insight-card__header">
                      <div className="insight-card__icon" style={{ background: "var(--warning-light)", color: "var(--amber-500)" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <span className="insight-card__title">Harvest Prediction</span>
                    </div>
                    <div style={{ marginBottom: "var(--space-sm)" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                        {harvest.estimated_harvest_start} → {harvest.estimated_harvest_end}
                      </div>
                      <span className="badge badge--info" style={{ marginTop: 4 }}>
                        {harvest.days_to_harvest} days remaining
                      </span>
                    </div>
                    <p className="insight-card__body">
                      Peak NDVI of {harvest.peak_ndvi} was reached on {harvest.peak_date}.
                      Confidence: {harvest.confidence_level}. {harvest.note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- Climate History --- */}
        {climate.length > 0 && (
          <div className="anim-stagger" style={{ "--stagger-index": 6 }}>
            <div className="section-header">
              <h2 className="section-header__title">Climate History</h2>
              <span className="badge badge--neutral">{climate.length} weeks</span>
            </div>
            <div className="card card--no-hover" style={{ padding: 0, overflow: "hidden" }}>
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Temperature</th>
                    <th>Humidity</th>
                    <th>Rainfall</th>
                  </tr>
                </thead>
                <tbody>
                  {climate.map((c, i) => (
                    <tr key={i}>
                      <td>{new Date(c.timestamp).toLocaleDateString()}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.value}°C</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.payload?.humidity_pct || "—"}%</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{c.payload?.rainfall_mm || 0} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- Water Usage --- */}
        {water.length > 0 && (
          <div className="anim-stagger" style={{ "--stagger-index": 7 }}>
            <div className="section-header">
              <h2 className="section-header__title">Irrigation & Water Usage</h2>
              <span className="badge badge--neutral">{water.length} records</span>
            </div>
            <div className="card card--no-hover" style={{ padding: 0, overflow: "hidden" }}>
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Water Used</th>
                    <th>Status</th>
                    <th>Crop Water Req.</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {water.map((w, i) => (
                    <tr key={i}>
                      <td>{new Date(w.timestamp).toLocaleDateString()}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {w.value ? `${(w.value / 1000).toFixed(0)} m³` : "—"}
                      </td>
                      <td>
                        <span className={`badge badge--${w.payload?.irrigation_status === "irrigation_due" ? "warning" : w.payload?.irrigation_status === "drying_down" ? "info" : "healthy"}`}>
                          {w.payload?.irrigation_status?.replace("_", " ") || "—"}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {w.payload?.crop_water_requirement_mm || "—"} mm
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {w.payload?.water_efficiency_ratio
                          ? `${(w.payload.water_efficiency_ratio * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}