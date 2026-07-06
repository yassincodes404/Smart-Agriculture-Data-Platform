/**
 * pages/compare/CompareLandsPage.jsx
 * -----------------------------------
 * Dynamic Side-by-side comparison of two lands using real API data.
 */

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { listLands, getLandDetail, getLandTimeseries, getCropHealth } from "../../services/api";
import "../Pages.css";
import "./CompareLands.css";

export default function CompareLandsPage() {
  const [lands, setLands] = useState([]);
  const [landAId, setLandAId] = useState("");
  const [landBId, setLandBId] = useState("");

  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch available lands for dropdowns
  useEffect(() => {
    async function fetchLands() {
      try {
        const res = await listLands();
        if (res.lands) {
          // Only allow comparing lands that have successfully processed data
          const validLands = res.lands.filter(l => {
            const s = (l.status || "").toLowerCase();
            return s === "ready" || s === "active" || s === "completed";
          });
          
          setLands(validLands);
          if (validLands.length > 0) {
            setLandAId(validLands[0].land_id.toString());
            if (validLands.length > 1) {
              setLandBId(validLands[1].land_id.toString());
            } else {
              setLandBId(validLands[0].land_id.toString());
            }
          }
        }
      } catch (err) {
        setError("Failed to load lands for comparison.");
      }
    }
    fetchLands();
  }, []);

  // 2. Fetch data for Land A when selection changes
  useEffect(() => {
    if (!landAId) return;
    async function fetchData() {
      setLoading(true);
      try {
        const [detail, timeseries, health] = await Promise.all([
          getLandDetail(landAId),
          getLandTimeseries(landAId, "crops"),
          getCropHealth(landAId).catch(() => null)
        ]);
        setDataA({ detail, timeseries, health });
      } catch (err) {
        console.error("Error fetching Land A:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [landAId]);

  // 3. Fetch data for Land B when selection changes
  useEffect(() => {
    if (!landBId) return;
    async function fetchData() {
      setLoading(true);
      try {
        const [detail, timeseries, health] = await Promise.all([
          getLandDetail(landBId),
          getLandTimeseries(landBId, "crops"),
          getCropHealth(landBId).catch(() => null)
        ]);
        setDataB({ detail, timeseries, health });
      } catch (err) {
        console.error("Error fetching Land B:", err);
      }
      setLoading(false);
    }
    fetchData();
  }, [landBId]);

  // Merge the NDVI timeseries data into a single array for Recharts
  const mergedChartData = useMemo(() => {
    if (!dataA?.timeseries?.points && !dataB?.timeseries?.points) return [];
    
    // Group by Date (YYYY-MM-DD)
    const map = new Map();

    const addPoints = (points, key) => {
      if (!points) return;
      points.forEach(p => {
        const date = p.timestamp.split("T")[0];
        if (!map.has(date)) map.set(date, { date });
        const entry = map.get(date);
        entry[key] = p.value;
      });
    };

    addPoints(dataA?.timeseries?.points, "ndviA");
    addPoints(dataB?.timeseries?.points, "ndviB");

    // Sort by date chronologically
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dataA, dataB]);

  // Helper to extract display values
  const getDisplayData = (data) => {
    if (!data || !data.detail) return null;
    
    const latestHealth = data.health ? data.health.health_status?.replace("_", " ") : "Unknown";
    const healthScore = data.health ? data.health.health_score : "—";
    
    // Extract latest crop info from timeseries if available
    const pts = data.timeseries?.points || [];
    const latestCrop = pts.length > 0 ? pts[pts.length - 1].payload?.crop_type : "Unknown";
    const latestNdvi = pts.length > 0 ? pts[pts.length - 1].value : "—";

    return {
      name: data.detail.name,
      area: `${data.detail.area_hectares?.toFixed(2) || "—"} ha`,
      crop: latestCrop,
      ndvi: latestNdvi,
      health: latestHealth,
      healthScore: healthScore,
      status: data.health?.health_score >= 70 ? "healthy" : (data.health?.health_score >= 40 ? "warning" : "critical")
    };
  };

  const displayA = getDisplayData(dataA);
  const displayB = getDisplayData(dataB);

  return (
    <div className="anim-fade-in compare-container" style={{ paddingBottom: "var(--space-2xl)" }}>
      <div className="page-header" style={{ textAlign: "center", marginBottom: "var(--space-2xl)" }}>
        <h1 className="page-header__title" style={{ fontSize: "2.5rem", background: "linear-gradient(90deg, var(--green-600), var(--blue-600))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Compare Lands</h1>
        <p className="page-header__subtitle" style={{ maxWidth: "600px", margin: "0 auto" }}>
          Side-by-side comparison of land metrics, health, and 365-day NDVI performance.
        </p>
      </div>

      {error && (
        <div className="error-state anim-fade-in" style={{ marginBottom: "var(--space-md)" }}>
          {error}
        </div>
      )}

      {/* Selectors */}
      <div className="compare-selectors-grid">
        <div className="compare-card-a anim-stagger" style={{ "--stagger-index": 0 }}>
          <label className="text-overline" style={{ display: "block", marginBottom: "var(--space-sm)", color: "var(--green-600)" }}>
            Land A
          </label>
          <select 
            className="compare-select" 
            value={landAId} 
            onChange={e => setLandAId(e.target.value)}
            disabled={lands.length === 0}
          >
            {lands.length === 0 ? (
              <option value="">No lands available</option>
            ) : (
              lands.map(l => (
                <option key={l.land_id} value={l.land_id}>{l.name}</option>
              ))
            )}
          </select>
        </div>
        
        <div className="compare-vs-badge anim-stagger" style={{ "--stagger-index": 1 }}>
          VS
        </div>
        
        <div className="compare-card-b anim-stagger" style={{ "--stagger-index": 2 }}>
          <label className="text-overline" style={{ display: "block", marginBottom: "var(--space-sm)", color: "var(--amber-600)" }}>
            Land B
          </label>
          <select 
            className="compare-select" 
            value={landBId} 
            onChange={e => setLandBId(e.target.value)}
            disabled={lands.length === 0}
          >
            {lands.length === 0 ? (
              <option value="">No lands available</option>
            ) : (
              lands.map(l => (
                <option key={l.land_id} value={l.land_id}>{l.name}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "var(--space-xl)" }}>Loading...</div>}

      {/* Comparison Header */}
      {!loading && displayA && displayB && (
        <>
          <div className="grid-2" style={{ marginBottom: 'var(--space-xl)', gap: 'var(--space-xl)' }}>
            <div className="card anim-stagger" style={{ "--stagger-index": 2, textAlign: 'center' }}>
              <div className="text-h3" style={{ marginBottom: 'var(--space-xs)', color: "var(--green-600)" }}>{displayA.name}</div>
              <div className="text-body-sm">{displayA.crop} • {displayA.area}</div>
              <span className={`badge badge--${displayA.status}`} style={{ marginTop: 'var(--space-sm)' }}>
                <span className="badge__dot" />
                {displayA.health} ({displayA.healthScore}/100)
              </span>
            </div>
            
            <div className="card anim-stagger" style={{ "--stagger-index": 3, textAlign: 'center' }}>
              <div className="text-h3" style={{ marginBottom: 'var(--space-xs)', color: "var(--amber-600)" }}>{displayB.name}</div>
              <div className="text-body-sm">{displayB.crop} • {displayB.area}</div>
              <span className={`badge badge--${displayB.status}`} style={{ marginTop: 'var(--space-sm)' }}>
                <span className="badge__dot" />
                {displayB.health} ({displayB.healthScore}/100)
              </span>
            </div>
          </div>

          {/* Overlap Chart */}
          <div className="card anim-stagger" style={{ "--stagger-index": 4, marginBottom: 'var(--space-xl)' }}>
            <div className="section-header">
              <h2 className="section-header__title">365-Day NDVI Performance Overlap</h2>
            </div>
            <div style={{ height: 400, width: "100%" }}>
              <ResponsiveContainer>
                <LineChart data={mergedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} minTickGap={30} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 'var(--radius-md)', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line 
                    type="monotone" 
                    name={displayA.name} 
                    dataKey="ndviA" 
                    stroke="var(--green-600)" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    type="monotone" 
                    name={displayB.name} 
                    dataKey="ndviB" 
                    stroke="var(--amber-500)" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="compare-table-wrapper anim-stagger" style={{ "--stagger-index": 5, marginBottom: 'var(--space-xl)' }}>
            <table className="premium-compare-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ textAlign: 'center' }}>{displayA.name}</th>
                  <th style={{ textAlign: 'center' }}>{displayB.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="metric-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Crop Type
                  </td>
                  <td style={{ textAlign: 'center' }} className="value-a">{displayA.crop}</td>
                  <td style={{ textAlign: 'center' }} className="value-b">{displayB.crop}</td>
                </tr>
                <tr>
                  <td className="metric-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
                    Area
                  </td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="value-a">{displayA.area}</td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="value-b">{displayB.area}</td>
                </tr>
                <tr>
                  <td className="metric-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Latest NDVI
                  </td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="value-a">
                    {typeof displayA.ndvi === "number" ? displayA.ndvi.toFixed(2) : displayA.ndvi}
                  </td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="value-b">
                    {typeof displayB.ndvi === "number" ? displayB.ndvi.toFixed(2) : displayB.ndvi}
                  </td>
                </tr>
                <tr>
                  <td className="metric-label">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    AI Health Score
                  </td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span className={`badge badge--${displayA.status}`}>
                      <span className="badge__dot" />
                      {displayA.healthScore} / 100
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span className={`badge badge--${displayB.status}`}>
                      <span className="badge__dot" />
                      {displayB.healthScore} / 100
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}