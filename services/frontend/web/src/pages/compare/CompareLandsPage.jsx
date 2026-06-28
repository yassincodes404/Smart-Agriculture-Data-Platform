/**
 * pages/compare/CompareLandsPage.jsx
 * -----------------------------------
 * Side-by-side comparison of registered lands.
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  getCropHealth,
  getHarvestPrediction,
  getLandTimeseries,
  getSoilStatus,
  listLands,
} from "../../services/api";
import NDVIChart from "../../components/charts/NDVIChart";
import ClimateChart from "../../components/charts/ClimateChart";
import "../Pages.css";

const STATUS_BADGE = {
  active: "healthy",
  completed: "healthy",
  processing: "warning",
  pending: "warning",
  failed: "error",
  error: "error",
};

function latestPoint(response) {
  const points = response?.points || [];
  return points.length ? points[points.length - 1] : null;
}

function payloadValue(point, keys) {
  const payload = point?.payload || {};
  for (const key of keys) {
    const value = payload[key] ?? point?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return point?.value ?? null;
}

function formatNumber(value, suffix = "", digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "No data yet";
  return `${number.toFixed(digits)}${suffix}`;
}

function formatText(value) {
  if (value === undefined || value === null || value === "") return "No data yet";
  return String(value);
}

function badgeForStatus(status) {
  return STATUS_BADGE[String(status || "").toLowerCase()] || "warning";
}

function baseLandSummary(land) {
  return {
    id: land?.land_id || "",
    name: land?.name || "Unnamed land",
    area: land?.area_hectares,
    status: land?.status || "processing",
    ndvi: null,
    temperature: null,
    humidity: null,
    rainfall: null,
    soilMoisture: null,
    soilPh: null,
    water: null,
    crop: "Unknown crop",
    healthScore: null,
    harvestWindow: null,
    cropSeries: [],
    climateSeries: [],
  };
}

function withTimeout(promise, fallback, ms = 6000) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function loadLandSummary(land) {
  const baseSummary = baseLandSummary(land);
  const [climate, crops, soil, water, cropHealth, harvest, soilStatus] = await Promise.all([
    withTimeout(getLandTimeseries(land.land_id, "climate"), { points: [] }),
    withTimeout(getLandTimeseries(land.land_id, "crops"), { points: [] }),
    withTimeout(getLandTimeseries(land.land_id, "soil"), { points: [] }),
    withTimeout(getLandTimeseries(land.land_id, "water"), { points: [] }),
    withTimeout(getCropHealth(land.land_id), null),
    withTimeout(getHarvestPrediction(land.land_id), null),
    withTimeout(getSoilStatus(land.land_id), null),
  ]);

  const climatePoint = latestPoint(climate);
  const cropPoint = latestPoint(crops);
  const soilPoint = latestPoint(soil);
  const waterPoint = latestPoint(water);

  return {
    ...baseSummary,
    ndvi: payloadValue(cropPoint, ["ndvi_mean", "ndvi", "mean_ndvi"]),
    temperature: payloadValue(climatePoint, ["temperature_c", "temperature", "temp_c"]),
    humidity: payloadValue(climatePoint, ["humidity_pct", "humidity", "relative_humidity"]),
    rainfall: payloadValue(climatePoint, ["rainfall_mm", "precipitation_mm", "rainfall"]),
    soilMoisture: payloadValue(soilPoint, ["soil_moisture_pct", "moisture_pct", "soil_moisture"]),
    soilPh: payloadValue(soilPoint, ["ph", "soil_ph"]) ?? soilStatus?.ph,
    water: payloadValue(waterPoint, ["water_stress", "status", "risk_level"]),
    crop: cropHealth?.crop_type || cropHealth?.detected_crop || baseSummary.crop,
    healthScore: cropHealth?.health_score ?? cropHealth?.score,
    harvestWindow: harvest?.expected_harvest_date || harvest?.harvest_window || harvest?.prediction,
    cropSeries: crops?.points || [],
    climateSeries: climate?.points || [],
  };
}

const METRICS = [
  { label: "Status", key: "status", format: formatText },
  { label: "Area", key: "area", format: (value) => formatNumber(value, " ha", 2) },
  { label: "NDVI", key: "ndvi", format: (value) => formatNumber(value, "", 2) },
  { label: "Temperature", key: "temperature", format: (value) => formatNumber(value, " C", 1) },
  { label: "Humidity", key: "humidity", format: (value) => formatNumber(value, "%", 0) },
  { label: "Rainfall", key: "rainfall", format: (value) => formatNumber(value, " mm", 1) },
  { label: "Soil Moisture", key: "soilMoisture", format: (value) => formatNumber(value, "%", 1) },
  { label: "Soil pH", key: "soilPh", format: (value) => formatNumber(value, "", 1) },
  { label: "Water Status", key: "water", format: formatText },
  { label: "Crop", key: "crop", format: formatText },
  { label: "Health Score", key: "healthScore", format: (value) => formatNumber(value, "%", 0) },
  { label: "Harvest Window", key: "harvestWindow", format: formatText },
];

export default function CompareLandsPage() {
  const [lands, setLands] = useState([]);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLands() {
      try {
        setLoading(true);
        const response = await listLands();
        if (cancelled) return;
        const nextLands = response?.lands || [];
        setLands(nextLands);
        setSummaries(
          nextLands.reduce((next, land) => {
            next[land.land_id] = baseLandSummary(land);
            return next;
          }, {})
        );
        setSelectedA(nextLands[0]?.land_id || "");
        setSelectedB(nextLands[1]?.land_id || nextLands[0]?.land_id || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load lands.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLands();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLands = useMemo(
    () => [selectedA, selectedB].map((id) => lands.find((land) => land.land_id === id)).filter(Boolean),
    [lands, selectedA, selectedB]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSummaries() {
      if (!selectedLands.length) return;

      setMetricsLoading(true);
      const loaded = await Promise.all(selectedLands.map(loadLandSummary));
      if (!cancelled) {
        setSummaries((current) => {
          const next = { ...current };
          loaded.forEach((summary) => {
            next[summary.id] = summary;
          });
          return next;
        });
        setMetricsLoading(false);
      }
    }

    loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [selectedLands]);

  const landA = lands.find((land) => land.land_id === selectedA);
  const landB = lands.find((land) => land.land_id === selectedB);
  const summaryA = summaries[selectedA] || baseLandSummary(landA);
  const summaryB = summaries[selectedB] || baseLandSummary(landB);
  const canCompare = lands.length >= 2 && selectedA && selectedB && selectedA !== selectedB;

  if (loading) {
    return <div className="card card--no-hover">Loading your lands...</div>;
  }

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Compare Lands</h1>
        <p className="page-header__subtitle">
          Compare any two registered lands using the latest available readings.
        </p>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {lands.length < 2 ? (
        <div className="card card--no-hover compare-empty">
          <h2 className="text-h3">Add one more land to compare</h2>
          <p className="text-body-sm">
            You currently have {lands.length} registered land{lands.length === 1 ? "" : "s"}.
          </p>
          <Link to="/lands/new" className="btn btn--primary">
            Add New Land
          </Link>
        </div>
      ) : (
        <>
          <div className="compare-selectors card card--no-hover">
            <label className="form-field">
              <span>First land</span>
              <select value={selectedA} onChange={(event) => setSelectedA(event.target.value)}>
                {lands.map((land) => (
                  <option key={land.land_id} value={land.land_id} disabled={land.land_id === selectedB}>
                    {land.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Second land</span>
              <select value={selectedB} onChange={(event) => setSelectedB(event.target.value)}>
                {lands.map((land) => (
                  <option key={land.land_id} value={land.land_id} disabled={land.land_id === selectedA}>
                    {land.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!canCompare ? (
            <div className="alert alert--warning">Choose two different lands to compare.</div>
          ) : (
            <>
              <div className="grid-2" style={{ marginBottom: "var(--space-xl)" }}>
                {[summaryA, summaryB].map((summary, index) => (
                  <div className="card anim-stagger compare-land-card" style={{ "--stagger-index": index }} key={index}>
                    <div className="text-h3">{summary?.name || "Loading..."}</div>
                    <div className="text-body-sm">
                      {summary ? `${formatNumber(summary.area, " ha", 2)} - ${summary.crop}` : "Loading data..."}
                    </div>
                    {summary && (
                      <span className={`badge badge--${badgeForStatus(summary.status)}`}>
                        <span className="badge__dot" />
                        {summary.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 2, padding: 0, overflow: "hidden" }}>
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th style={{ textAlign: "center" }}>{summaryA?.name || "First land"}</th>
                      <th style={{ textAlign: "center" }}>{summaryB?.name || "Second land"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((metric) => (
                      <tr key={metric.label}>
                        <td style={{ fontWeight: 600 }}>{metric.label}</td>
                        <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {summaryA ? metric.format(summaryA[metric.key]) : "Loading..."}
                        </td>
                        <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                          {summaryB ? metric.format(summaryB[metric.key]) : "Loading..."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="compare-chart-grid anim-stagger" style={{ "--stagger-index": 3 }}>
                <div className="card card--no-hover compare-chart-card">
                  <div className="section-header">
                    <h2 className="section-header__title">{summaryA.name} NDVI</h2>
                    <span className="badge badge--info">{summaryA.cropSeries.length} observations</span>
                  </div>
                  {summaryA.cropSeries.length > 0 ? (
                    <NDVIChart data={summaryA.cropSeries} />
                  ) : (
                    <div className="empty-state compare-chart-empty">
                      <p className="text-body-sm">No NDVI chart data yet.</p>
                    </div>
                  )}
                </div>
                <div className="card card--no-hover compare-chart-card">
                  <div className="section-header">
                    <h2 className="section-header__title">{summaryB.name} NDVI</h2>
                    <span className="badge badge--info">{summaryB.cropSeries.length} observations</span>
                  </div>
                  {summaryB.cropSeries.length > 0 ? (
                    <NDVIChart data={summaryB.cropSeries} />
                  ) : (
                    <div className="empty-state compare-chart-empty">
                      <p className="text-body-sm">No NDVI chart data yet.</p>
                    </div>
                  )}
                </div>
                <div className="card card--no-hover compare-chart-card">
                  <div className="section-header">
                    <h2 className="section-header__title">{summaryA.name} Climate</h2>
                    <span className="badge badge--neutral">{summaryA.climateSeries.length} readings</span>
                  </div>
                  {summaryA.climateSeries.length > 0 ? (
                    <ClimateChart data={summaryA.climateSeries} />
                  ) : (
                    <div className="empty-state compare-chart-empty">
                      <p className="text-body-sm">No climate chart data yet.</p>
                    </div>
                  )}
                </div>
                <div className="card card--no-hover compare-chart-card">
                  <div className="section-header">
                    <h2 className="section-header__title">{summaryB.name} Climate</h2>
                    <span className="badge badge--neutral">{summaryB.climateSeries.length} readings</span>
                  </div>
                  {summaryB.climateSeries.length > 0 ? (
                    <ClimateChart data={summaryB.climateSeries} />
                  ) : (
                    <div className="empty-state compare-chart-empty">
                      <p className="text-body-sm">No climate chart data yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {metricsLoading && <div className="text-body-sm compare-loading">Updating comparison data...</div>}
              {(summaryA?.status === "processing" || summaryB?.status === "processing") && (
                <div className="alert alert--warning compare-processing-note">
                  Some readings may stay empty while backend analysis is still processing.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
