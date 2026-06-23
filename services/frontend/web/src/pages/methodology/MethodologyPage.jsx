/**
 * pages/methodology/MethodologyPage.jsx
 * --------------------------------------
 * Explains data sources, NDVI calculation, and platform methodology.
 */

import "../Pages.css";

const DATA_SOURCES = [
  {
    name: "Sentinel-2",
    description: "European Space Agency satellite providing 10m resolution multispectral imagery for vegetation monitoring.",
    color: "var(--info)",
    bg: "var(--info-light)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    name: "Open-Meteo",
    description: "High-resolution weather data including temperature, humidity, precipitation, and wind speed for all Egyptian governorates.",
    color: "var(--amber-500)",
    bg: "var(--warning-light)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    name: "SoilGrids",
    description: "Global soil information system providing pH, organic carbon, nitrogen, and texture data at 250m resolution.",
    color: "var(--green-600)",
    bg: "var(--green-50)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 22h20" />
        <path d="M7 22V12l-5 4" />
        <path d="M12 22V2l-5 10h10L12 2" />
        <path d="M17 22v-8l5 4" />
      </svg>
    ),
  },
  {
    name: "MODIS",
    description: "NASA satellite for broad-scale vegetation analysis and land surface temperature monitoring across large regions.",
    color: "var(--error)",
    bg: "var(--error-light)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

export default function MethodologyPage() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Data & Methodology</h1>
        <p className="page-header__subtitle">
          How we collect, process, and analyze agricultural data to generate actionable intelligence.
        </p>
      </div>

      {/* NDVI Formula */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="section-header">
          <h2 className="section-header__title">NDVI Calculation</h2>
        </div>
        <div className="formula-box anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="formula-box__label">Normalized Difference Vegetation Index</div>
          NDVI = (B08 - B04) / (B08 + B04)
        </div>
        <div className="grid-3" style={{ marginTop: 'var(--space-lg)' }}>
          <div className="card anim-stagger" style={{ "--stagger-index": 1, textAlign: 'center' }}>
            <div className="text-overline" style={{ marginBottom: 'var(--space-sm)' }}>B08 (NIR)</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              Near-Infrared band — reflected strongly by healthy vegetation
            </div>
          </div>
          <div className="card anim-stagger" style={{ "--stagger-index": 2, textAlign: 'center' }}>
            <div className="text-overline" style={{ marginBottom: 'var(--space-sm)' }}>B04 (RED)</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              Red band — absorbed by chlorophyll in healthy plants
            </div>
          </div>
          <div className="card anim-stagger" style={{ "--stagger-index": 3, textAlign: 'center' }}>
            <div className="text-overline" style={{ marginBottom: 'var(--space-sm)' }}>Result</div>
            <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              Value from -1 to +1 — higher values indicate denser, healthier vegetation
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div>
        <div className="section-header">
          <h2 className="section-header__title">Data Sources</h2>
        </div>
        <div className="grid-2">
          {DATA_SOURCES.map((source, i) => (
            <div className="content-card anim-stagger" style={{ "--stagger-index": i + 4 }} key={source.name}>
              <div className="content-card__icon" style={{ background: source.bg, color: source.color }}>
                {source.icon}
              </div>
              <div className="content-card__title">{source.name}</div>
              <div className="content-card__description">{source.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}