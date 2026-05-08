/**
 * pages/compare/CompareLandsPage.jsx
 * -----------------------------------
 * Side-by-side comparison of two lands.
 */

import "../Pages.css";

const LAND_A = {
  name: "Al Fayyum — Plot B",
  crop: "Wheat",
  area: "24.5 ha",
  ndvi: 0.58,
  temp: "28°C",
  humidity: "45%",
  rainfall: "12mm",
  soilPh: "7.2",
  status: "warning",
};

const LAND_B = {
  name: "Alexandria Coastal",
  crop: "Cotton",
  area: "31.8 ha",
  ndvi: 0.81,
  temp: "25°C",
  humidity: "62%",
  rainfall: "28mm",
  soilPh: "6.8",
  status: "healthy",
};

const COMPARE_METRICS = [
  { label: "NDVI",        keyA: "ndvi",     keyB: "ndvi",     format: (v) => typeof v === "number" ? v.toFixed(2) : v },
  { label: "Temperature", keyA: "temp",     keyB: "temp" },
  { label: "Humidity",    keyA: "humidity",  keyB: "humidity" },
  { label: "Rainfall",    keyA: "rainfall",  keyB: "rainfall" },
  { label: "Soil pH",     keyA: "soilPh",   keyB: "soilPh" },
  { label: "Area",        keyA: "area",     keyB: "area" },
  { label: "Crop",        keyA: "crop",     keyB: "crop" },
];

export default function CompareLandsPage() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Compare Lands</h1>
        <p className="page-header__subtitle">
          Side-by-side comparison of land metrics, health, and performance.
        </p>
      </div>

      {/* Comparison Header */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card anim-stagger" style={{ "--stagger-index": 0, textAlign: 'center' }}>
          <div className="text-h3" style={{ marginBottom: 'var(--space-xs)' }}>{LAND_A.name}</div>
          <div className="text-body-sm">{LAND_A.crop} • {LAND_A.area}</div>
          <span className={`badge badge--${LAND_A.status}`} style={{ marginTop: 'var(--space-sm)' }}>
            <span className="badge__dot" />
            {LAND_A.status.charAt(0).toUpperCase() + LAND_A.status.slice(1)}
          </span>
        </div>
        <div className="card anim-stagger" style={{ "--stagger-index": 1, textAlign: 'center' }}>
          <div className="text-h3" style={{ marginBottom: 'var(--space-xs)' }}>{LAND_B.name}</div>
          <div className="text-body-sm">{LAND_B.crop} • {LAND_B.area}</div>
          <span className={`badge badge--${LAND_B.status}`} style={{ marginTop: 'var(--space-sm)' }}>
            <span className="badge__dot" />
            {LAND_B.status.charAt(0).toUpperCase() + LAND_B.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 2, padding: 0, overflow: 'hidden' }}>
        <table className="logs-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th style={{ textAlign: 'center' }}>{LAND_A.name}</th>
              <th style={{ textAlign: 'center' }}>{LAND_B.name}</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_METRICS.map((metric) => {
              const valA = LAND_A[metric.keyA];
              const valB = LAND_B[metric.keyB];
              const displayA = metric.format ? metric.format(valA) : valA;
              const displayB = metric.format ? metric.format(valB) : valB;
              return (
                <tr key={metric.label}>
                  <td style={{ fontWeight: 600 }}>{metric.label}</td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{displayA}</td>
                  <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{displayB}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}