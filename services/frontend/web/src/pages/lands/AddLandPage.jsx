/**
 * pages/lands/AddLandPage.jsx
 * ----------------------------
 * Register a new land parcel.
 *
 * Flow:
 *   1. User draws polygon/circle/rectangle on the Leaflet map
 *   2. User fills in land name + optional description
 *   3. Submit → POST /api/v1/lands/discover
 *   4. Backend validates polygon, computes centroid + area, enqueues pipeline
 *   5. Redirect to land details page
 *
 * Follows: documents/Frontend/07_UI_UX_Style_Guide.md
 * Plan:    documents/Frontend/08_Map_and_Satellite_Integration_Plan.md §1
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { discoverLand } from "../../services/api";
import MapDrawComponent from "../../components/map/MapDrawComponent";
import "../Lands.css";

export default function AddLandPage() {
  const navigate = useNavigate();

  /* ── Form state ─────────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [geometry, setGeometry] = useState(null);
  const [shapeStats, setShapeStats] = useState(null);

  /* ── Submission state ───────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(null); // "submitting" | "analyzing" | "done"

  /* ── Map callback ───────────────────────────────────────────── */
  const handleGeometryChange = useCallback((geojson, stats) => {
    setGeometry(geojson);
    setShapeStats(stats);
    setError(null);
  }, []);

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Please enter a land name.");
      return;
    }
    if (!geometry) {
      setError("Please draw your land boundaries on the map.");
      return;
    }

    setLoading(true);
    setPhase("submitting");

    try {
      // Phase 1: Submit to backend
      setPhase("analyzing");
      const result = await discoverLand({
        name: name.trim(),
        description: description.trim() || null,
        geometry,
      });

      // Phase 2: Success
      setPhase("done");

      // Short delay to show success state, then redirect
      setTimeout(() => {
        navigate(`/lands/${result.land_id}`);
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to register land. Please try again.");
      setLoading(false);
      setPhase(null);
    }
  };

  /* ── Phase messages ─────────────────────────────────────────── */
  const phaseMessages = {
    submitting: "Sending to server...",
    analyzing: "Analyzing your land — computing area, fetching soil & climate data...",
    done: "Land registered! Redirecting...",
  };

  return (
    <div className="anim-fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate("/lands")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <h1 className="page-header__title">Register New Land</h1>
        <p className="page-header__subtitle">
          Draw your land boundaries on the map and provide a name to start monitoring.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="alert alert--error anim-slide-down" style={{ marginBottom: "var(--space-lg)" }}>
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Two-column layout: Map + Form */}
      <form onSubmit={handleSubmit} className="add-land-layout">
        {/* Left: Map */}
        <div className="anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="section-header">
            <h2 className="section-header__title">Land Boundaries</h2>
            {shapeStats && (
              <span className="badge badge--healthy">
                <span className="badge__dot" />
                Shape drawn
              </span>
            )}
          </div>
          <MapDrawComponent onGeometryChange={handleGeometryChange} />
        </div>

        {/* Right: Form */}
        <div className="anim-stagger" style={{ "--stagger-index": 1 }}>
          <div className="section-header">
            <h2 className="section-header__title">Land Details</h2>
          </div>
          <div className="add-land-form">
            {/* Land Name */}
            <div className="input-group">
              <label htmlFor="land-name" className="input-label">
                Land Name <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <input
                  id="land-name"
                  type="text"
                  className="input-field"
                  placeholder="e.g., Nile Delta - Plot A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Description */}
            <div className="input-group">
              <label htmlFor="land-description" className="input-label">
                Description (optional)
              </label>
              <div className="input-wrapper">
                <textarea
                  id="land-description"
                  className="input-field input-field--no-icon"
                  placeholder="Describe this land plot — crop type, irrigation source, nearby landmarks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  style={{ height: 110, padding: 14, resize: "vertical" }}
                />
              </div>
            </div>

            {/* Preview: Geometry stats (only when shape drawn) */}
            {shapeStats && (
              <div className="card anim-fade-in" style={{ marginBottom: "var(--space-md)" }}>
                <div className="text-overline" style={{ marginBottom: "var(--space-sm)" }}>
                  Polygon Preview
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <div className="text-caption">Center</div>
                    <div className="text-body-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {shapeStats.center[0].toFixed(4)}°N, {shapeStats.center[1].toFixed(4)}°E
                    </div>
                  </div>
                  <div>
                    <div className="text-caption">Approx. Area</div>
                    <div className="text-body-sm" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {shapeStats.areaApprox} hectares
                    </div>
                  </div>
                  <div>
                    <div className="text-caption">Vertices</div>
                    <div className="text-body-sm">{shapeStats.vertexCount} points</div>
                  </div>
                  <div>
                    <div className="text-caption">Type</div>
                    <div className="text-body-sm">GeoJSON Polygon</div>
                  </div>
                </div>
                <div className="text-caption" style={{ marginTop: "var(--space-sm)", color: "var(--gray-400)" }}>
                  Final area will be computed precisely by the backend.
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => navigate("/lands")}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !geometry || !name.trim()}
                id="submit-land-btn"
              >
                {loading ? (
                  <span className="btn__loading">
                    <span className="spinner" />
                    {phaseMessages[phase] || "Processing..."}
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Register Land
                  </>
                )}
              </button>
            </div>

            {/* Processing state */}
            {phase === "analyzing" && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="card anim-fade-in" style={{ width: 520, padding: "var(--space-2xl)", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
                  {/* Animated top bar */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--gray-100)" }}>
                    <div style={{ 
                      height: "100%", 
                      background: "linear-gradient(90deg, var(--primary-light), var(--primary))", 
                      width: "50%",
                      transition: "width 0.3s ease",
                      transform: "translateX(50%)",
                      animation: "slide-indeterminate 1.5s infinite ease-in-out alternate" 
                    }} />
                  </div>
                  
                  <div style={{ width: 80, height: 80, background: "var(--primary-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-lg)" }}>
                    <div className="spinner spinner--lg spinner--dark" style={{ borderTopColor: "var(--primary)" }}></div>
                  </div>

                  <h2 className="text-h2" style={{ marginBottom: "var(--space-sm)" }}>
                    Initializing Land Discovery...
                  </h2>
                  <p className="text-body-sm" style={{ marginBottom: "var(--space-xl)", color: "var(--gray-600)", padding: "0 var(--space-md)" }}>
                    Connecting to Microsoft Planetary Computer to fetch real Sentinel-2 L2A STAC datasets for this coordinate. This may take 30-60 seconds due to raster file size.
                  </p>

                  <div style={{ background: "var(--gray-50)", padding: "var(--space-lg)", borderRadius: "var(--radius-md)", textAlign: "left", border: "1px solid var(--gray-200)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, color: "var(--primary)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-body-sm" style={{ fontWeight: 600, color: "var(--gray-700)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Live Task Progress</span>
                    </div>
                    <div style={{ fontSize: 16, color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      Initializing STAC search...
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        <span style={{ animation: "pulse 1s infinite alternate" }}>.</span>
                        <span style={{ animation: "pulse 1s infinite alternate 0.2s" }}>.</span>
                        <span style={{ animation: "pulse 1s infinite alternate 0.4s" }}>.</span>
                      </span>
                    </div>
                  </div>
                  
                  <style>{`
                    @keyframes slide-indeterminate {
                      0% { transform: translateX(-100%); width: 30%; }
                      100% { transform: translateX(300%); width: 80%; }
                    }
                    @keyframes pulse {
                      0% { opacity: 0.2; }
                      100% { opacity: 1; }
                    }
                  `}</style>
                </div>
              </div>
            )}

            {phase === "done" && (
              <div className="card anim-fade-in" style={{ marginTop: "var(--space-md)", borderColor: "var(--green-300)", background: "var(--green-50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--green-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <div className="text-body-sm" style={{ fontWeight: 600, color: "var(--green-700)" }}>
                      Land registered successfully!
                    </div>
                    <div className="text-caption">Redirecting to your land dashboard...</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}