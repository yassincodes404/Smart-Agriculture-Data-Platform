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
  const [trackingFrequency, setTrackingFrequency] = useState("16 days");
  const [primaryCrop, setPrimaryCrop] = useState("");
  const [trackingVariables, setTrackingVariables] = useState(["ndvi", "climate", "soil", "water"]);
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
      const selectedVariables = trackingVariables.length > 0
        ? trackingVariables.join(", ")
        : "standard monitoring";
      const metadata = [
        primaryCrop.trim() ? `Primary crop: ${primaryCrop.trim()}` : null,
        `Tracking frequency: ${trackingFrequency}`,
        `Tracking variables: ${selectedVariables}`,
      ].filter(Boolean).join("\n");
      const fullDescription = [description.trim(), metadata].filter(Boolean).join("\n\n");

      // Phase 1: Submit to backend
      setPhase("analyzing");
      const result = await discoverLand({
        name: name.trim(),
        description: fullDescription || null,
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

  const toggleTrackingVariable = (key) => {
    setTrackingVariables((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
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

            <div className="add-land-fields-grid">
              <div className="input-group">
                <label htmlFor="primary-crop" className="input-label">
                  Primary Crop
                </label>
                <div className="input-wrapper">
                  <input
                    id="primary-crop"
                    type="text"
                    className="input-field input-field--no-icon"
                    placeholder="e.g., Wheat, Cotton, Maize"
                    value={primaryCrop}
                    onChange={(e) => setPrimaryCrop(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="tracking-frequency" className="input-label">
                  Tracking Frequency
                </label>
                <div className="input-wrapper">
                  <select
                    id="tracking-frequency"
                    className="input-field input-field--select input-field--no-icon"
                    value={trackingFrequency}
                    onChange={(e) => setTrackingFrequency(e.target.value)}
                    disabled={loading}
                  >
                    <option value="7 days">Every 7 days</option>
                    <option value="14 days">Every 14 days</option>
                    <option value="16 days">Every 16 days</option>
                    <option value="30 days">Every 30 days</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Tracking Variables</label>
              <div className="tracking-options">
                {[
                  { key: "ndvi", label: "NDVI" },
                  { key: "climate", label: "Climate" },
                  { key: "soil", label: "Soil" },
                  { key: "water", label: "Water" },
                ].map((item) => (
                  <label className="tracking-option" key={item.key}>
                    <input
                      type="checkbox"
                      checked={trackingVariables.includes(item.key)}
                      onChange={() => toggleTrackingVariable(item.key)}
                      disabled={loading}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
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
              <div className="card anim-fade-in" style={{ marginTop: "var(--space-md)", borderColor: "var(--green-200)", background: "var(--green-50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <div className="spinner spinner--dark" />
                  <div>
                    <div className="text-body-sm" style={{ fontWeight: 600, color: "var(--green-700)" }}>
                      Analyzing your land...
                    </div>
                    <div className="text-caption">
                      Computing centroid, calculating area, fetching soil &amp; climate data from satellite sources.
                    </div>
                  </div>
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
