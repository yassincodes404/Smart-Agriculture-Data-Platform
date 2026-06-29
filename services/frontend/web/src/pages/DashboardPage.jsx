/**
 * pages/DashboardPage.jsx
 * -----------------------
 * Main Dashboard — fetches real data from the backend.
 * Shows aggregate stats, recent land, NDVI chart, and intelligence feed.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listLands, getLandTimeseries, getCropHealth, getHarvestPrediction, healthCheck } from "../services/api";
import NDVIChart from "../components/charts/NDVIChart";
import "./Dashboard.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lands, setLands] = useState([]);
  const [ndviData, setNdviData] = useState([]);
  const [cropHealth, setCropHealth] = useState(null);
  const [harvest, setHarvest] = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Check backend health
        healthCheck().then((r) => setBackendOk(r.status === "backend running")).catch(() => setBackendOk(false));

        // Fetch all lands
        const landsRes = await listLands();
        const allLands = landsRes.lands || [];
        setLands(allLands);

        // Prefer a land that already has an active/ready status for dashboard metrics.
        if (allLands.length > 0) {
          const preferredLand = allLands.find((land) => land.status === "ready" || land.status === "active") || allLands[0];
          const preferredLandId = preferredLand.land_id;
          getLandTimeseries(preferredLandId, "crops")
            .then((r) => setNdviData(r.points || []))
            .catch(() => {});
          getCropHealth(preferredLandId)
            .then((r) => setCropHealth(r))
            .catch(() => {});
          getHarvestPrediction(preferredLandId)
            .then((r) => setHarvest(r))
            .catch(() => {});
        }
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalArea = lands.reduce((sum, l) => sum + (l.area_hectares || 0), 0);
  const readyCount = lands.filter((l) => l.status === "ready" || l.status === "active").length;
  const processingCount = lands.filter((l) => l.status === "processing").length;
  const latestNDVI = ndviData.length > 0 ? ndviData[ndviData.length - 1]?.value : null;

  if (loading) {
    return (
      <div className="anim-fade-in">
        <div className="page-header">
          <h1 className="page-header__title">Welcome back</h1>
          <p className="page-header__subtitle">Loading your dashboard...</p>
        </div>
        <div className="grid-4" style={{ marginBottom: "var(--space-xl)" }}>
          {[0, 1, 2, 3].map((i) => <div className="skeleton" key={i} style={{ height: 100, borderRadius: "var(--radius-lg)" }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">
          Welcome back, {user?.email?.split("@")[0] || "Farmer"} 👋
        </h1>
        <p className="page-header__subtitle">
          Here's the latest intelligence from your {lands.length} registered land{lands.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {processingCount > 0 && (
        <div className="alert alert--warning" style={{ marginBottom: "var(--space-lg)" }}>
          {processingCount} land{processingCount !== 1 ? "s are" : " is"} still processing, so some readings may stay empty
          until the backend analysis finishes.
        </div>
      )}

      {/* System Status */}
      <div className="anim-stagger" style={{ "--stagger-index": 0 }}>
        {backendOk !== null && (
          <div className={`alert alert--${backendOk ? "success" : "error"}`} style={{ marginBottom: "var(--space-lg)" }}>
            {backendOk
              ? "✅ All systems operational — Backend API, Database, and Frontend connected."
              : "⚠️ Backend API is unreachable. Some features may not work."}
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid-4 anim-stagger" style={{ "--stagger-index": 1, marginBottom: "var(--space-xl)" }}>
        <div className="stat-card stat-card--green" onClick={() => navigate("/lands")} style={{ cursor: "pointer" }}>
          <div className="stat-card__content">
            <div className="stat-card__value">{lands.length}</div>
            <div className="stat-card__label">Total Lands</div>
          </div>
        </div>
        <div className="stat-card stat-card--blue">
          <div className="stat-card__content">
            <div className="stat-card__value">{totalArea.toFixed(1)}</div>
            <div className="stat-card__label">Total Hectares</div>
          </div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-card__content">
            <div className="stat-card__value">{latestNDVI !== null ? latestNDVI.toFixed(2) : "—"}</div>
            <div className="stat-card__label">Latest NDVI</div>
          </div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__content">
            <div className="stat-card__value">{readyCount}/{lands.length}</div>
            <div className="stat-card__label">Lands Active</div>
          </div>
        </div>
      </div>

      {/* Two-column layout: NDVI chart + Intelligence */}
      <div className="dashboard-split anim-stagger" style={{ "--stagger-index": 2 }}>
        {/* NDVI Chart */}
        <div className="card card--no-hover" style={{ flex: 2 }}>
          <div className="section-header" style={{ marginBottom: "var(--space-md)" }}>
            <h2 className="section-header__title">NDVI Vegetation Index</h2>
            <span className="badge badge--info">{ndviData.length} observations</span>
          </div>
          {ndviData.length > 0 ? (
            <div style={{ height: 200, width: "100%", marginTop: "var(--space-md)" }}>
              <NDVIChart data={ndviData} />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
              <p className="text-body-sm">No NDVI data available yet.</p>
            </div>
          )}
        </div>

        {/* Intelligence Feed */}
        <div className="card card--no-hover" style={{ flex: 1 }}>
          <div className="section-header" style={{ marginBottom: "var(--space-md)" }}>
            <h2 className="section-header__title">Intelligence</h2>
            <span className="badge badge--info">
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}>
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3a.5.5 0 011 0v4a.5.5 0 01-1 0V4zm.5 7.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
              AI
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {cropHealth && (
              <div className="intel-item">
                <div className="intel-item__dot" style={{ background: cropHealth.health_score >= 70 ? "var(--green-500)" : "var(--amber-500)" }} />
                <div>
                  <div className="text-body-sm" style={{ fontWeight: 600 }}>Crop Health: {cropHealth.health_score}/100</div>
                  <div className="text-caption">{cropHealth.advice?.slice(0, 100)}...</div>
                </div>
              </div>
            )}
            {harvest && harvest.prediction_available && (
              <div className="intel-item">
                <div className="intel-item__dot" style={{ background: harvest.days_to_harvest <= 14 ? "var(--amber-500)" : "var(--green-500)" }} />
                <div>
                  <div className="text-body-sm" style={{ fontWeight: 600 }}>
                    Harvest in {harvest.days_to_harvest} days
                  </div>
                  <div className="text-caption">
                    Window: {harvest.estimated_harvest_start} → {harvest.estimated_harvest_end}
                  </div>
                </div>
              </div>
            )}
            {latestNDVI !== null && (
              <div className="intel-item">
                <div className="intel-item__dot" style={{ background: latestNDVI > 0.5 ? "var(--green-500)" : "var(--amber-500)" }} />
                <div>
                  <div className="text-body-sm" style={{ fontWeight: 600 }}>NDVI: {latestNDVI.toFixed(2)}</div>
                  <div className="text-caption">
                    Stage: {ndviData[ndviData.length - 1]?.payload?.growth_stage?.replace("_", " ")} •
                    Trend: {ndviData[ndviData.length - 1]?.payload?.ndvi_trend}
                  </div>
                </div>
              </div>
            )}
            {!cropHealth && !harvest && latestNDVI === null && (
              <div className="empty-state" style={{ padding: "var(--space-md)" }}>
                <p className="text-body-sm">Register a land to see AI insights.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Lands */}
      {lands.length > 0 && (
        <div className="anim-stagger" style={{ "--stagger-index": 3, marginTop: "var(--space-xl)" }}>
          <div className="section-header">
            <h2 className="section-header__title">Your Lands</h2>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate("/lands")}>
              View All →
            </button>
          </div>
          <div className="grid-3">
            {lands.slice(0, 6).map((land, i) => (
              <div
                key={land.land_id}
                className="land-card anim-stagger"
                style={{ "--stagger-index": i + 4, cursor: "pointer" }}
                onClick={() => navigate(`/lands/${land.land_id}`)}
              >
                <div className="land-card__thumb">
                  <div className="land-card__thumb-gradient" />
                  <span className={`badge badge--${land.status === "ready" ? "healthy" : "warning"}`} style={{ position: "absolute", top: 12, right: 12 }}>
                    <span className="badge__dot" />
                    {land.status}
                  </span>
                </div>
                <div className="land-card__body">
                  <h3 className="land-card__name">{land.name}</h3>
                  <div className="land-card__meta">
                    <span>{land.area_hectares || "—"} ha</span>
                    <span>{land.latitude.toFixed(3)}°N</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
