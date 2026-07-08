/**
 * pages/methodology/MethodologyPage.jsx — Data sources, NDVI & processing methodology
 */

import { useNavigate } from "react-router-dom";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import "../Pages.css";
import "./Methodology.css";

const NDVI_SCALE = [
  { range: "< 0.20", label: "Bare soil / very sparse", tone: "low" },
  { range: "0.20 – 0.40", label: "Moderate vegetation", tone: "moderate" },
  { range: "0.40 – 0.60", label: "Healthy crops", tone: "healthy" },
  { range: "> 0.60", label: "Dense vegetation", tone: "dense" },
];

const PIPELINE = [
  { title: "Geometry stored", body: "Field boundary saved as GeoJSON in PostgreSQL + PostGIS." },
  { title: "STAC query", body: "Sentinel-2 scenes fetched from Microsoft Planetary Computer." },
  { title: "NDVI computed", body: "Per-pixel index from B08 (NIR) and B04 (RED) bands." },
  { title: "Layers enriched", body: "Climate (Open-Meteo) and soil (SoilGrids) attached to the land." },
  { title: "Insights delivered", body: "Smoothed timeseries, health scores, and AgriMind AI analysis." },
];

const DATA_SOURCES = [
  {
    name: "Sentinel-2",
    provider: "ESA · Microsoft Planetary Computer",
    description: "Primary vegetation source. Multispectral L2A imagery clipped to your field boundary for NDVI timeseries and satellite previews.",
    color: "var(--info)",
    bg: "var(--info-light)",
    tags: ["10m resolution", "5-day revisit", "B04 + B08"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    name: "Open-Meteo",
    provider: "Open-Meteo API",
    description: "Hourly and daily weather variables — temperature, humidity, precipitation, wind, and soil moisture — contextualize crop stress alongside NDVI.",
    color: "var(--amber-500)",
    bg: "var(--warning-light)",
    tags: ["Global coverage", "Soil moisture", "Egypt-wide"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    name: "SoilGrids",
    provider: "ISRIC SoilGrids 250m",
    description: "Static soil profile properties — pH, organic carbon, nitrogen, texture — used for suitability scoring and agronomic context on each land.",
    color: "var(--green-600)",
    bg: "var(--green-50)",
    tags: ["250m resolution", "pH & texture", "Crop suitability"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 22h20" />
        <path d="M7 22V12l-5 4" />
        <path d="M12 22V2l-5 10h10L12 2" />
        <path d="M17 22v-8l5 4" />
      </svg>
    ),
  },
  {
    name: "MODIS",
    provider: "NASA LP DAAC",
    description: "Complementary 16-day NDVI composites for broad-scale vegetation trends and cross-validation when Sentinel-2 scenes are cloudy or unavailable.",
    color: "var(--error)",
    bg: "var(--error-light)",
    tags: ["250m composites", "16-day cadence", "Long-term trend"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
];

const ARCHITECTURE = [
  {
    name: "FastAPI Processing",
    description: "Land registration triggers geospatial pipelines directly through the REST API. Heavy imagery work runs asynchronously without blocking the UI.",
    color: "var(--info)",
    bg: "var(--info-light)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    name: "APScheduler Monitoring",
    description: "A dedicated scheduler container re-checks registered lands on a cadence, keeping NDVI and environmental layers up to date over time.",
    color: "var(--amber-500)",
    bg: "var(--warning-light)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    name: "PostgreSQL & PostGIS",
    description: "Spatial datastore for land geometries, timeseries points, satellite metadata, and soft-delete archiving with full relational integrity.",
    color: "var(--green-600)",
    bg: "var(--green-50)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    name: "Groq AI (AgriMind)",
    description: "LLM-powered agronomist reads your land's NDVI, soil, and climate context to produce insights, chat responses, and structured recommendations.",
    color: "#7c3aed",
    bg: "#f3e8ff",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a7 7 0 00-4 12.7V19a2 2 0 002 2h4a2 2 0 002-2v-3.3A7 7 0 0012 3z" />
        <path d="M9 22h6" />
      </svg>
    ),
  },
];

const QUALITY_NOTES = [
  "Cloud cover can delay Sentinel-2 scenes — the platform may use synthetic fallback data at registration until real imagery is available.",
  "SoilGrids provides regional estimates at 250m; field-level soil tests remain the gold standard for precision decisions.",
  "NDVI is most reliable during active growth stages — bare soil and harvest periods naturally produce lower values.",
  "AI recommendations supplement, not replace, agronomist judgment and local field knowledge.",
];

export default function MethodologyPage() {
  const navigate = useNavigate();
  const { isDrawer } = useBreakpoint();
  const isMobileLayout = isDrawer;

  return (
    <div className={`anim-fade-in methodology-page${isMobileLayout ? " methodology-page--mobile" : ""}`}>
      <section className="methodology-hero anim-stagger" style={{ "--stagger-index": 0 }}>
        <span className="methodology-hero__blob methodology-hero__blob--1" aria-hidden="true" />
        <span className="methodology-hero__blob methodology-hero__blob--2" aria-hidden="true" />
        <span className="methodology-hero__badge">Transparent by design</span>
        <h1 className="methodology-hero__title">
          {isMobileLayout ? "Data & Methodology" : "How we turn raw data into farm intelligence"}
        </h1>
        <p className="methodology-hero__subtitle">
          Every chart, health score, and AI insight on the platform traces back to open geospatial
          sources, reproducible NDVI math, and a containerized processing pipeline you can trust.
        </p>
      </section>

      <section className="methodology-section anim-stagger" style={{ "--stagger-index": 1 }}>
        <div className="methodology-section__head">
          <h2 className="methodology-section__title">NDVI calculation</h2>
          <p className="methodology-section__desc">
            The Normalized Difference Vegetation Index is the core vegetation health signal across the platform.
          </p>
        </div>

        <div className="methodology-formula">
          <div className="methodology-formula__label">Normalized Difference Vegetation Index</div>
          <div className="methodology-formula__expr">NDVI = (B08 − B04) / (B08 + B04)</div>
          <p className="methodology-formula__note">
            Computed per pixel from Sentinel-2 Level-2A bands, then aggregated over your field polygon.
          </p>
        </div>

        <div className="methodology-band-grid">
          <div className="methodology-band-card anim-stagger" style={{ "--stagger-index": 2 }}>
            <span className="methodology-band-card__tag methodology-band-card__tag--nir">Band B08</span>
            <div className="methodology-band-card__title">Near-Infrared (NIR)</div>
            <p className="methodology-band-card__body">
              Strongly reflected by healthy leaf tissue. High NIR values indicate active photosynthesis.
            </p>
          </div>
          <div className="methodology-band-card anim-stagger" style={{ "--stagger-index": 3 }}>
            <span className="methodology-band-card__tag methodology-band-card__tag--red">Band B04</span>
            <div className="methodology-band-card__title">Red (Visible)</div>
            <p className="methodology-band-card__body">
              Absorbed by chlorophyll. Healthy plants absorb more red light, lowering the denominator contrast.
            </p>
          </div>
          <div className="methodology-band-card anim-stagger" style={{ "--stagger-index": 4 }}>
            <span className="methodology-band-card__tag methodology-band-card__tag--result">Output</span>
            <div className="methodology-band-card__title">Index range −1 to +1</div>
            <p className="methodology-band-card__body">
              Higher values mean denser, healthier vegetation. Values near zero indicate bare soil or sparse cover.
            </p>
          </div>
        </div>

        <div className="methodology-scale" aria-label="NDVI interpretation guide">
          {NDVI_SCALE.map((item) => (
            <div
              className={`methodology-scale__item methodology-scale__item--${item.tone}`}
              key={item.range}
            >
              <div className="methodology-scale__range">{item.range}</div>
              <div className="methodology-scale__label">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="methodology-section anim-stagger" style={{ "--stagger-index": 5 }}>
        <div className="methodology-section__head">
          <h2 className="methodology-section__title">Processing pipeline</h2>
          <p className="methodology-section__desc">
            From the moment you draw a boundary to the insights on your dashboard — five automated stages.
          </p>
        </div>
        <div className="methodology-pipeline">
          {PIPELINE.map((step, i) => (
            <div className="methodology-pipeline-step" key={step.title}>
              <div className="methodology-pipeline-step__num">{i + 1}</div>
              <div className="methodology-pipeline-step__title">{step.title}</div>
              <p className="methodology-pipeline-step__body">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="methodology-section anim-stagger" style={{ "--stagger-index": 6 }}>
        <div className="methodology-section__head">
          <h2 className="methodology-section__title">Data sources</h2>
          <p className="methodology-section__desc">
            Open, peer-reviewed datasets power every environmental layer on your land detail page.
          </p>
        </div>
        <div className="methodology-source-grid">
          {DATA_SOURCES.map((source, i) => (
            <div className="methodology-source-card anim-stagger" style={{ "--stagger-index": i + 7 }} key={source.name}>
              <div className="methodology-source-card__top">
                <div className="methodology-source-card__icon" style={{ background: source.bg, color: source.color }}>
                  {source.icon}
                </div>
                <div className="methodology-source-card__meta">
                  <div className="methodology-source-card__name">{source.name}</div>
                  <div className="methodology-source-card__provider">{source.provider}</div>
                </div>
              </div>
              <p className="methodology-source-card__body">{source.description}</p>
              <div className="methodology-source-card__tags">
                {source.tags.map((tag) => (
                  <span className="methodology-source-tag" key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="methodology-section anim-stagger" style={{ "--stagger-index": 8 }}>
        <div className="methodology-section__head">
          <h2 className="methodology-section__title">Platform architecture</h2>
          <p className="methodology-section__desc">
            Lightweight Docker services — no external task queues — keeping the stack simple and observable.
          </p>
        </div>
        <div className="methodology-arch-grid">
          {ARCHITECTURE.map((item, i) => (
            <div className="methodology-arch-card anim-stagger" style={{ "--stagger-index": i + 9 }} key={item.name}>
              <div className="methodology-arch-card__icon" style={{ background: item.bg, color: item.color }}>
                {item.icon}
              </div>
              <div className="methodology-arch-card__title">{item.name}</div>
              <p className="methodology-arch-card__body">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="methodology-quality anim-stagger" style={{ "--stagger-index": 10 }}>
        <div className="methodology-quality__title">Data quality & limitations</div>
        <ul className="methodology-quality__list">
          {QUALITY_NOTES.map((note) => (
            <li className="methodology-quality__item" key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="methodology-cta anim-stagger" style={{ "--stagger-index": 11 }}>
        <div>
          <div className="methodology-cta__title">See it on your own land</div>
          <p className="methodology-cta__body">
            Register a field and watch the pipeline populate NDVI charts, soil profiles, and AI insights in real time.
          </p>
        </div>
        <div className="methodology-cta__actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate("/lands/new")}>
            Register a Land
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate("/about")}>
            About the Project
          </button>
        </div>
      </section>
    </div>
  );
}