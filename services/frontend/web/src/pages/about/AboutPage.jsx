/**
 * pages/about/AboutPage.jsx
 * -------------------------
 * Project overview, goals, and technology stack.
 */

import "../Pages.css";

const TECH_STACK = [
  { name: "React + Vite",  category: "Frontend",    description: "Modern reactive UI with fast hot-reload development." },
  { name: "FastAPI",        category: "Backend",     description: "High-performance Python web framework for the REST API." },
  { name: "MySQL",          category: "Database",    description: "Relational database for structured agricultural data." },
  { name: "Docker",         category: "Infrastructure", description: "Containerized deployment for consistent environments." },
  { name: "Sentinel-2 API", category: "Data Source", description: "Microsoft Planetary Computer STAC API for satellite imagery." },
  { name: "OpenCV",         category: "Processing",  description: "Computer vision library for NDVI calculation and image analysis." },
];

export default function AboutPage() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">About the Project</h1>
        <p className="page-header__subtitle">
          Smart Agriculture Data Platform — empowering Egyptian agriculture through technology.
        </p>
      </div>

      {/* Mission */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="content-card card--no-hover anim-stagger" style={{ "--stagger-index": 0, borderLeft: '4px solid var(--green-500)' }}>
          <div className="content-card__title">Our Mission</div>
          <div className="content-card__description" style={{ fontSize: '15px', lineHeight: 1.7 }}>
            To provide Egyptian farmers, agricultural analysts, and policymakers with a comprehensive
            intelligence platform that combines satellite imagery, climate data, soil analysis, and
            AI-powered insights. Our goal is to make precision agriculture accessible and actionable,
            enabling data-driven decisions that improve crop yields, optimize water usage, and ensure
            sustainable farming practices across all 27 governorates of Egypt.
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div>
        <div className="section-header">
          <h2 className="section-header__title">Technology Stack</h2>
        </div>
        <div className="grid-3">
          {TECH_STACK.map((tech, i) => (
            <div className="card anim-stagger" style={{ "--stagger-index": i + 1 }} key={tech.name}>
              <div className="text-overline" style={{ marginBottom: 'var(--space-sm)', color: 'var(--green-600)' }}>
                {tech.category}
              </div>
              <div className="text-h3" style={{ marginBottom: 'var(--space-sm)' }}>{tech.name}</div>
              <p className="text-body-sm">{tech.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}