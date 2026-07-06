/**
 * pages/lands/LandsPage.jsx
 * -------------------------
 * Lands Explorer — browse all registered agricultural lands.
 * Fetches real data from GET /api/v1/lands.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listLands } from "../../services/api";
import "../Lands.css";

export default function LandsPage() {
  const navigate = useNavigate();
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLands();
      setLands(res.lands || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLands();
  }, [fetchLands]);

  const statusColor = (status) => {
    if (!status) return "info";
    const s = status.toLowerCase();
    
    // Success/Ready states
    if (s === "ready" || s === "active" || s === "completed") return "healthy";
    
    // Error states
    if (s === "error" || s === "failed" || s.includes("fail") || s.includes("error") || s.includes("not found")) return "critical";
    
    // Processing states (matches "processing", "Step X/Y", "fetching", etc)
    if (s === "processing" || s.includes("step") || s.includes("fetch") || s.includes("download") || s.includes("generat")) return "warning";
    
    return "info";
  };

  const filteredLands = lands
    .filter((l) => filter === "all" || statusColor(l.status) === filter)
    .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="anim-fade-in" style={{ padding: "var(--space-3xl)" }}>
        <div className="lands-hero skeleton-hero"></div>
        <div className="grid-3" style={{ marginTop: "var(--space-xl)" }}>
          {[0, 1, 2].map((i) => (
            <div className="card skeleton" key={i} style={{ height: 280 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-in lands-page-container">
      {/* Premium Hero Section */}
      <div className="lands-hero">
        <div className="lands-hero__content">
          <h1 className="lands-hero__title">Explore Lands</h1>
          <p className="lands-hero__subtitle">
            Manage and monitor {lands.length} registered plot{lands.length !== 1 ? "s" : ""} in real-time
          </p>
        </div>
        <div className="lands-hero__blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>
      </div>

      {/* Glassmorphic Controls */}
      <div className="lands-glass-controls anim-stagger" style={{ "--stagger-index": 0 }}>
        <div className="lands-glass-controls__left">
          <div className="search-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="glass-input"
              placeholder="Search by land name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lands-glass-filters">
            {[
              { key: "all", label: "All" },
              { key: "healthy", label: "Ready" },
              { key: "warning", label: "Processing" },
              { key: "critical", label: "Error" },
            ].map((f) => (
              <button
                key={f.key}
                className={`glass-filter-btn ${filter === f.key ? "active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--primary premium-add-btn" onClick={() => navigate("/lands/new")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Land
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert--error" style={{ marginBottom: "var(--space-lg)", borderRadius: "var(--radius-lg)" }}>
          <strong>Error:</strong> {error}
          <button className="btn btn--secondary btn--sm" onClick={fetchLands} style={{ marginLeft: "auto" }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {filteredLands.length === 0 && !error && (
        <div className="empty-state premium-empty" style={{ padding: "var(--space-3xl)" }}>
          <div className="empty-icon-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 className="text-h3">No lands found</h3>
          <p className="text-body-sm" style={{ marginTop: "var(--space-sm)", color: "var(--text-secondary)" }}>
            {search ? `No results for "${search}"` : "Start by registering your first agricultural land."}
          </p>
          {!search && (
            <button className="btn btn--primary" style={{ marginTop: "var(--space-lg)" }} onClick={() => navigate("/lands/new")}>
              Register Your First Land
            </button>
          )}
        </div>
      )}

      {/* Lands Grid */}
      <div className="lands-premium-grid">
        {filteredLands.map((land, i) => (
          <div
            key={land.public_id}
            className="premium-land-card anim-stagger"
            style={{ "--stagger-index": i + 1 }}
            onClick={() => navigate(`/lands/${land.public_id}`)}
          >
            {/* Card thumbnail with dynamic gradient based on status */}
            <div 
              className={`premium-land-card__thumb status-${statusColor(land.status)}`}
              style={land.latest_image_url ? { backgroundImage: `url(${land.latest_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            >
              <div className="thumb-overlay"></div>
              <span className={`premium-badge badge--${statusColor(land.status)}`}>
                <span className="badge__dot" />
                {land.status.charAt(0).toUpperCase() + land.status.slice(1)}
              </span>
            </div>

            {/* Card content */}
            <div className="premium-land-card__body">
              <h3 className="premium-land-card__name">{land.name}</h3>
              
              <div className="premium-land-card__stats">
                <div className="stat-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{land.latitude.toFixed(3)}°, {land.longitude.toFixed(3)}°</span>
                </div>
                <div className="stat-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                  <span>{land.area_hectares || "—"} ha</span>
                </div>
              </div>
              
              <div className="premium-land-card__footer">
                <span className="date-label">Added {new Date(land.created_at).toLocaleDateString()}</span>
                <div className="explore-btn">
                  Explore
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
