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
    if (status === "ready" || status === "active") return "healthy";
    if (status === "processing") return "warning";
    if (status === "error") return "critical";
    return "info";
  };

  const filteredLands = lands
    .filter((l) => filter === "all" || statusColor(l.status) === filter)
    .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="anim-fade-in" style={{ padding: "var(--space-3xl)" }}>
        <div className="page-header">
          <h1 className="page-header__title">Lands Explorer</h1>
          <p className="page-header__subtitle">Loading your agricultural plots...</p>
        </div>
        <div className="grid-3">
          {[0, 1, 2].map((i) => (
            <div className="card skeleton" key={i} style={{ height: 200 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Lands Explorer</h1>
        <p className="page-header__subtitle">
          {lands.length} registered plot{lands.length !== 1 ? "s" : ""} across Egypt
        </p>
      </div>

      {/* Controls */}
      <div className="lands-controls anim-stagger" style={{ "--stagger-index": 0 }}>
        <div className="lands-controls__left">
          <input
            type="text"
            className="input"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <div className="lands-controls__filters">
            {[
              { key: "all", label: "All" },
              { key: "healthy", label: "Ready" },
              { key: "warning", label: "Processing" },
              { key: "critical", label: "Error" },
            ].map((f) => (
              <button
                key={f.key}
                className={`btn btn--sm ${filter === f.key ? "btn--primary" : "btn--ghost"}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate("/lands/new")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Land
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert--error" style={{ marginBottom: "var(--space-lg)" }}>
          <strong>Error:</strong> {error}
          <button className="btn btn--secondary btn--sm" onClick={fetchLands} style={{ marginLeft: "auto" }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {filteredLands.length === 0 && !error && (
        <div className="empty-state" style={{ padding: "var(--space-3xl)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, marginBottom: "var(--space-md)" }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h3 className="text-h3">No lands found</h3>
          <p className="text-body-sm" style={{ marginTop: "var(--space-sm)" }}>
            {search ? `No results for "${search}"` : "Start by registering your first agricultural land."}
          </p>
          {!search && (
            <button className="btn btn--primary" style={{ marginTop: "var(--space-md)" }} onClick={() => navigate("/lands/new")}>
              Register Your First Land
            </button>
          )}
        </div>
      )}

      {/* Lands Grid */}
      <div className="grid-3">
        {filteredLands.map((land, i) => (
          <div
            key={land.land_id}
            className="land-card anim-stagger"
            style={{ "--stagger-index": i + 1, cursor: "pointer" }}
            onClick={() => navigate(`/lands/${land.land_id}`)}
          >
            {/* Card thumbnail */}
            <div className="land-card__thumb">
              <div className="land-card__thumb-gradient" />
              <span className={`badge badge--${statusColor(land.status)}`} style={{ position: "absolute", top: 12, right: 12 }}>
                <span className="badge__dot" />
                {land.status.charAt(0).toUpperCase() + land.status.slice(1)}
              </span>
            </div>

            {/* Card content */}
            <div className="land-card__body">
              <h3 className="land-card__name">{land.name}</h3>
              <div className="land-card__meta">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, verticalAlign: "middle", marginRight: 4 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {land.latitude.toFixed(3)}°N, {land.longitude.toFixed(3)}°E
                </span>
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, verticalAlign: "middle", marginRight: 4 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                  {land.area_hectares || "—"} ha
                </span>
              </div>
              <div className="text-caption" style={{ marginTop: "var(--space-sm)" }}>
                Registered: {new Date(land.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
