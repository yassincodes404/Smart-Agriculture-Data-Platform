/**
 * pages/DashboardPage.jsx
 * -----------------------
 * Main Dashboard — fetches real data from the backend.
 * Shows aggregate stats, recent land, NDVI chart, and intelligence feed.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listLands, getLandTimeseries, getCropHealth, getHarvestPrediction, healthCheck, getAiInsights, triggerAiAnalysis } from "../services/api";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
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
  const [aiInsights, setAiInsights] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [analyzingLandId, setAnalyzingLandId] = useState(null);

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
          const preferredLandPublicId = preferredLand.public_id;
          getLandTimeseries(preferredLandPublicId, "crops")
            .then((r) => setNdviData(r.points || []))
            .catch(() => {});
          getCropHealth(preferredLandPublicId)
            .then((r) => setCropHealth(r))
            .catch(() => {});
          getHarvestPrediction(preferredLandPublicId)
            .then((r) => setHarvest(r))
            .catch(() => {});
            
          // Fetch AI Insights
          setAiLoading(true);
          setAiError(null);
          getAiInsights(preferredLandPublicId)
            .then((r) => setAiInsights(r.insights || []))
            .catch((err) => {
              console.error("Failed to load AI insights:", err);
              if (err.response?.status === 429) {
                setAiError("AI Quota Finished. Please try again later or upgrade your plan.");
              } else {
                setAiError("Could not load AI Insights right now.");
              }
              setAiInsights([]);
            })
            .finally(() => setAiLoading(false));
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
  const preferredLandId = lands.find((land) => land.status === "ready" || land.status === "active")?.public_id || lands[0]?.public_id;

  const handleTriggerAnalysis = async () => {
    if (!preferredLandId) return;
    setAnalyzingLandId(preferredLandId);
    setAiError(null);
    try {
      await triggerAiAnalysis(preferredLandId);
      // Wait a bit, then re-fetch
      setTimeout(async () => {
        try {
          const res = await getAiInsights(preferredLandId);
          setAiInsights(res.insights || []);
          setAiError(null);
        } catch (err) {
          if (err.response?.status === 429) {
            setAiError("AI Quota Finished. Please try again later.");
          } else {
            setAiError("Failed to fetch new AI Insights.");
          }
        } finally {
          setAnalyzingLandId(null);
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 429) {
        setAiError("AI Quota Finished. Please try again later.");
      } else {
        setAiError("Failed to trigger AI Analysis.");
      }
      setAnalyzingLandId(null);
    }
  };

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
      <div className="premium-hero">
        <h1 className="page-header__title" style={{ color: "var(--green-800)", marginBottom: "var(--space-xs)" }}>
          Welcome back, {user?.email?.split("@")[0] || "Farmer"} 👋
        </h1>
        <p className="page-header__subtitle" style={{ fontSize: "1.1rem", color: "var(--green-700)" }}>
          Here's the latest intelligence from your {lands.length} registered land{lands.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {processingCount > 0 && (
        <div className="alert alert--warning" style={{ marginBottom: "var(--space-lg)" }}>
          {processingCount} land{processingCount !== 1 ? "s are" : " is"} still processing, so some readings may stay empty
          until the backend analysis finishes.
        </div>
      )}

      {/* System Status removed per user request */}

      {/* Stat Cards */}
      <div className="grid-4 anim-stagger" style={{ "--stagger-index": 1, marginBottom: "var(--space-xl)" }}>
        <div className="premium-stat-card" onClick={() => navigate("/lands")} style={{ cursor: "pointer" }}>
          <div className="stat-card__value" style={{ color: "var(--green-600)" }}>{lands.length}</div>
          <div className="stat-card__label">Total Lands</div>
        </div>
        <div className="premium-stat-card">
          <div className="stat-card__value" style={{ color: "var(--info)" }}>{totalArea.toFixed(1)}</div>
          <div className="stat-card__label">Total Hectares</div>
        </div>
        <div className="premium-stat-card">
          <div className="stat-card__value" style={{ color: "var(--amber-500)" }}>{latestNDVI !== null ? latestNDVI.toFixed(2) : "—"}</div>
          <div className="stat-card__label">Latest NDVI</div>
        </div>
        <div className="premium-stat-card">
          <div className="stat-card__value" style={{ color: "var(--green-600)" }}>{readyCount}/{lands.length}</div>
          <div className="stat-card__label">Lands Active</div>
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

        {/* Lands Breakdown Chart */}
        <div className="card card--no-hover" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="section-header" style={{ marginBottom: "var(--space-md)" }}>
            <h2 className="section-header__title">Lands Breakdown</h2>
          </div>
          <div style={{ flex: 1, minHeight: 200, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: readyCount, color: 'var(--green-500)' },
                    { name: 'Processing', value: processingCount, color: 'var(--info)' },
                    { name: 'Error', value: lands.filter((l) => l.status === "error").length, color: 'var(--error)' },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {
                    [
                      { name: 'Active', value: readyCount, color: 'var(--green-500)' },
                      { name: 'Processing', value: processingCount, color: 'var(--info)' },
                      { name: 'Error', value: lands.filter((l) => l.status === "error").length, color: 'var(--error)' },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))
                  }
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} 
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      {preferredLandId && (
        <div className="ai-insights-panel anim-stagger" style={{ "--stagger-index": 3 }}>
          <div className="ai-insights-header">
            <div>
              <span className="ai-badge">✨ AI Agronomist</span>
              <h2 className="section-header__title" style={{ marginTop: "var(--space-sm)" }}>Deep Intelligence</h2>
            </div>
            <button 
              className="ai-trigger-btn" 
              onClick={handleTriggerAnalysis}
              disabled={analyzingLandId === preferredLandId}
            >
              {analyzingLandId === preferredLandId ? "Analyzing..." : "Generate AI Analysis"}
            </button>
          </div>
          
          {aiLoading ? (
            <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-secondary)" }}>
              Loading AI Insights...
            </div>
          ) : aiError ? (
            <div className="alert alert--error" style={{ margin: "var(--space-md)", padding: "var(--space-lg)" }}>
              <div style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>AI Analysis Error</div>
              {aiError}
            </div>
          ) : aiInsights.length > 0 ? (
            <div className="ai-card-grid">
              {aiInsights.map((insight) => (
                <div key={insight.insight_id} className="ai-insight-card">
                  <div className="ai-insight-title">{insight.title}</div>
                  <div className="ai-insight-body">{insight.body}</div>
                  <div style={{ marginTop: "var(--space-sm)", display: "flex", gap: "var(--space-sm)" }}>
                    <span className="badge badge--info" style={{ fontSize: "0.75rem" }}>
                      Confidence: {Math.round(insight.confidence * 100)}%
                    </span>
                    <span className="badge badge--neutral" style={{ fontSize: "0.75rem" }}>
                      {insight.model_used || "groq"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "var(--space-xl)" }}>
              <p className="text-body-sm">No AI insights generated yet. Click the button above to run an analysis on your primary land.</p>
            </div>
          )}
        </div>
      )}

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
                onClick={() => navigate(`/lands/${land.public_id}`)}
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
