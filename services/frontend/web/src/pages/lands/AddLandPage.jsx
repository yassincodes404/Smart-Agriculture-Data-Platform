/**
 * pages/lands/AddLandPage.jsx — Register a new land parcel
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { discoverLand } from "../../services/api";
import { useNotifications } from "../../context/NotificationContext";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import MapDrawComponent from "../../components/map/MapDrawComponent";
import "../Lands.css";
import "./AddLand.css";

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "SmartAgriPlatform/1.0" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function suggestCropFromLocation(geocode) {
  const addr = geocode?.address || {};
  const region = [
    addr.state, addr.county, addr.city, addr.village, addr.town, addr.suburb,
  ].filter(Boolean).join(" ").toLowerCase();

  if (!region) return null;
  if (region.match(/delta|kafr|damietta|beheira|sharqia|menofia|dakahlia|gharbia/)) {
    return "Rice, Cotton, or Vegetables";
  }
  if (region.match(/fayoum|beni suef|minya|asyut|sohag|qena|luxor/)) {
    return "Sugarcane, Wheat, or Clover";
  }
  if (region.match(/aswan|red sea|sinai|matrouh/)) {
    return "Date Palm or Olive";
  }
  if (region.match(/giza|cairo|Alexandria|ismailia/)) {
    return "Vegetables or Citrus";
  }
  return null;
}

export default function AddLandPage() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { isDrawer } = useBreakpoint();
  const isMobileLayout = isDrawer;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trackingFrequency, setTrackingFrequency] = useState("16 days");
  const [trackingVariables, setTrackingVariables] = useState(["ndvi", "climate", "soil", "water"]);
  const [geometry, setGeometry] = useState(null);
  const [shapeStats, setShapeStats] = useState(null);

  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiAutoFilling, setAiAutoFilling] = useState(false);
  const [aiDismissed, setAiDismissed] = useState(false);
  const userEditedName = useRef(false);
  const userEditedDesc = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const handleGeometryChange = useCallback(async (geojson, stats) => {
    setGeometry(geojson);
    setShapeStats(stats);
    setError(null);
    setAiDismissed(false);

    if (stats?.center) {
      const [lat, lng] = stats.center;
      setAiAutoFilling(true);
      try {
        const geo = await reverseGeocode(lat, lng);
        if (geo) {
          const addr = geo.address || {};
          const parts = [
            addr.village || addr.hamlet || addr.suburb || addr.city_district,
            addr.city || addr.town || addr.county,
            addr.state,
            addr.country,
          ].filter(Boolean);

          const locationName = parts[0] || parts[1] || "Farm";
          const suggestedName = `${locationName} Farm`;
          const cropHint = suggestCropFromLocation(geo);
          const suggestedDesc = [
            parts.slice(0, 3).join(", "),
            stats.areaApprox ? `Approx. ${stats.areaApprox} ha` : null,
            cropHint ? `Typical crops: ${cropHint}` : null,
          ].filter(Boolean).join(" • ");

          setAiSuggestion({ name: suggestedName, description: suggestedDesc, cropHint });
          if (!userEditedName.current) setName(suggestedName);
          if (!userEditedDesc.current) setDescription(suggestedDesc);
        }
      } catch {
        // non-fatal
      } finally {
        setAiAutoFilling(false);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

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
      setPhase("analyzing");
      const result = await discoverLand({
        name: name.trim(),
        description: description.trim() || null,
        geometry,
        metadata_: { trackingFrequency, trackingVariables },
      });

      setPhase("done");
      addNotification({
        type: "land_created",
        severity: "low",
        message: `Land "${name.trim() || "New land"}" registered successfully. Monitoring started.`,
        land_id: result.public_id,
      });

      setTimeout(() => navigate(`/lands/${result.public_id}`), 1200);
    } catch (err) {
      setError(err.message || "Failed to register land. Please try again.");
      setLoading(false);
      setPhase(null);
    }
  };

  const toggleTrackingVariable = (key) => {
    setTrackingVariables((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const canSubmit = !loading && !!geometry && !!name.trim();
  const step1Done = !!geometry;
  const step2Done = !!name.trim();
  const activeStep = step1Done ? 2 : 1;
  const progressPct = step1Done && step2Done ? 100 : step1Done ? 50 : 0;

  const processingMessage =
    phase === "done"
      ? "Opening your land page…"
      : phase === "analyzing"
        ? "Fetching satellite imagery and environmental data. This may take up to a minute."
        : "Saving your land registration…";

  return (
    <div className={`anim-fade-in add-land-page${isMobileLayout ? " add-land-page--mobile" : ""}${loading ? " add-land-page--processing" : ""}${mapFullscreen ? " add-land-page--map-fullscreen" : ""}`}>
      <header className="add-land-header">
        <div className="add-land-header__bar">
          <button
            type="button"
            className="add-land-header__back"
            onClick={() => navigate("/lands")}
            aria-label="Back to lands"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="add-land-header__titles">
            <h1 className="add-land-header__title">Register New Land</h1>
            <p className="add-land-header__subtitle">
              Draw your field boundary on the map, then fill in the details to start satellite monitoring.
            </p>
          </div>
          {step1Done && (
            <span className="add-land-header__badge">
              {shapeStats?.areaApprox ?? "—"} ha
            </span>
          )}
        </div>

        <div className="add-land-progress" aria-label="Registration progress">
          <div className="add-land-progress__track" aria-hidden="true">
            <div className="add-land-progress__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <ol className="add-land-progress__steps">
            <li className={`add-land-progress__step${step1Done ? " add-land-progress__step--done" : activeStep === 1 ? " add-land-progress__step--active" : ""}`}>
              <span className="add-land-progress__dot">{step1Done ? "✓" : "1"}</span>
              <div className="add-land-progress__copy">
                <span className="add-land-progress__label">Draw boundary</span>
                <span className="add-land-progress__hint">
                  {step1Done ? `${shapeStats?.areaApprox ?? "—"} ha drawn` : "Use the map below"}
                </span>
              </div>
            </li>
            <li className={`add-land-progress__step${step2Done ? " add-land-progress__step--done" : activeStep === 2 ? " add-land-progress__step--active" : ""}`}>
              <span className="add-land-progress__dot">{step2Done ? "✓" : "2"}</span>
              <div className="add-land-progress__copy">
                <span className="add-land-progress__label">Land details</span>
                <span className="add-land-progress__hint">
                  {step2Done ? name : "Name & tracking"}
                </span>
              </div>
            </li>
          </ol>
        </div>
      </header>

      {error && (
        <div className="alert alert--error anim-slide-down">
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="add-land-layout">
        <section className="add-land-map-section">
          <div className="add-land-section-intro">
            <div className="add-land-section-intro__head">
              <h2 className="add-land-section-intro__title">Land Boundaries</h2>
              {shapeStats && (
                <span className="badge badge--healthy">
                  <span className="badge__dot" />
                  Shape ready
                </span>
              )}
            </div>
            <p className="add-land-section-intro__desc">
              Outline your field on the map — this boundary defines the area we monitor with satellite imagery and environmental data.
            </p>
          </div>

          <div className={`add-land-map-card${mapFullscreen ? " add-land-map-card--fullscreen-active" : ""}`}>
            <MapDrawComponent
              onGeometryChange={handleGeometryChange}
              onFullscreenChange={setMapFullscreen}
            />
          </div>
        </section>

        <section className="add-land-form-section">
          <div className="add-land-section-intro add-land-section-intro--form">
            <h2 className="add-land-section-intro__title">Land Details</h2>
            <p className="add-land-section-intro__desc">
              Name your parcel and choose tracking options for ongoing monitoring.
            </p>
          </div>

          <div className="add-land-form">
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
                  onChange={(e) => { userEditedName.current = true; setName(e.target.value); }}
                  required
                  disabled={loading}
                />
              </div>
              {aiAutoFilling && (
                <div className="add-land-ai-loading">
                  <span className="spinner" style={{ width: 12, height: 12 }} />
                  Filling from location…
                </div>
              )}
              {aiSuggestion && !aiDismissed && !aiAutoFilling && (
                <div className="add-land-ai-banner">
                  <span aria-hidden="true">✨</span>
                  <span className="add-land-ai-banner__text">
                    {aiSuggestion.cropHint
                      ? `AI hint: ${aiSuggestion.cropHint}`
                      : "AI suggested name from location"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiDismissed(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", padding: 0 }}
                    aria-label="Dismiss AI suggestion"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="land-description" className="input-label">Description (optional)</label>
              <div className="input-wrapper">
                <textarea
                  id="land-description"
                  className="input-field input-field--no-icon"
                  placeholder="Crop type, irrigation source, nearby landmarks…"
                  value={description}
                  onChange={(e) => { userEditedDesc.current = true; setDescription(e.target.value); }}
                  disabled={loading}
                  style={{ height: 96, padding: 14, resize: "vertical" }}
                />
              </div>
            </div>

            <div className="add-land-fields-grid">
              <div className="input-group">
                <label htmlFor="tracking-frequency" className="input-label">Tracking Frequency</label>
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
              <div className="tracking-options add-land-tracking-options">
                {[
                  { key: "ndvi", label: "NDVI" },
                  { key: "climate", label: "Climate" },
                  { key: "soil", label: "Soil" },
                  { key: "water", label: "Water" },
                ].map((item) => (
                  <label className="tracking-option" key={item.key}>
                    <input
                      type="checkbox"
                      checked={item.key === "ndvi" ? true : trackingVariables.includes(item.key)}
                      onChange={() => item.key !== "ndvi" && toggleTrackingVariable(item.key)}
                      disabled={loading || item.key === "ndvi"}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {shapeStats && (
              <div className="add-land-preview anim-fade-in">
                <div className="text-overline" style={{ marginBottom: "var(--space-sm)" }}>Boundary summary</div>
                <div className="add-land-preview__grid">
                  <div>
                    <div className="text-caption">Center</div>
                    <div className="text-body-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {shapeStats.center[0].toFixed(4)}°N, {shapeStats.center[1].toFixed(4)}°E
                    </div>
                  </div>
                  <div>
                    <div className="text-caption">Approx. area</div>
                    <div className="text-body-sm" style={{ fontWeight: 600 }}>{shapeStats.areaApprox} ha</div>
                  </div>
                </div>
              </div>
            )}

            <div className="add-land-form-actions add-land-form-actions--desktop">
              <button type="button" className="btn btn--secondary" onClick={() => navigate("/lands")} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                {loading ? (
                  <span className="btn__loading">
                    <span className="spinner" />
                    Processing…
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Register Land
                  </>
                )}
              </button>
            </div>

          </div>
        </section>
      </form>

      {isMobileLayout && !mapFullscreen && !loading && (
        <div className="add-land-sticky-footer">
          <button type="button" className="btn btn--secondary" onClick={() => navigate("/lands")} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {loading ? "Processing…" : "Register Land"}
          </button>
        </div>
      )}

      {loading && (
        <div className="add-land-processing anim-slide-up" role="status" aria-live="polite">
          <div className="add-land-processing__progress" aria-hidden="true">
            <div className={`add-land-processing__progress-fill${phase === "done" ? " add-land-processing__progress-fill--done" : ""}`} />
          </div>
          <div className="add-land-processing__content">
            <div className={`add-land-processing__icon${phase === "done" ? " add-land-processing__icon--done" : ""}`}>
              {phase === "done" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <span className="spinner" />
              )}
            </div>
            <div className="add-land-processing__copy">
              <span className="add-land-processing__title">
                {phase === "done" ? "Land registered" : "Setting up monitoring"}
              </span>
              <span className="add-land-processing__message">{processingMessage}</span>
            </div>
            <span className="add-land-processing__land">{name.trim()}</span>
          </div>
        </div>
      )}
    </div>
  );
}