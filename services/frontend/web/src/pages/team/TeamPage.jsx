/**
 * pages/team/TeamPage.jsx
 * -----------------------
 * Showcase the team members.
 */

import "../Pages.css";
import "./TeamPage.css"; // We will create this for specific team enhancements

const TEAM = [
  {
    name: "Yassin Tarek",
    role: "Project Lead & Backend Developer",
    bio: "Responsible for system architecture, FastAPI backend, and complex data pipeline orchestrations.",
    gradient: "linear-gradient(135deg, #10b981, #047857)",
  },
  {
    name: "Omar Ahmed",
    role: "Frontend Developer",
    bio: "Implements the interactive React/Vite frontend, real-time dashboard UI, and rich satellite viewer components.",
    gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  },
  {
    name: "Yousef Gerges",
    role: "Data Pipeline Contributor",
    bio: "Handles geospatial data processing, NDVI algorithmic calculations, and soil analysis integration.",
    gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
  },
  {
    name: "Tarek Ibrahim",
    role: "Database Contributor",
    bio: "Designs and maintains robust MySQL schemas, query performance optimization, and ensures absolute data integrity.",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  },
  {
    name: "Mohammed Ismail",
    role: "ML Crop Detection & Methodology",
    bio: "Pioneers the machine learning strategies for multi-spectral crop detection. Specializes in designing robust training methodologies and complex validation frameworks for satellite imagery.",
    gradient: "linear-gradient(135deg, #ec4899, #be185d)",
  }
];

export default function TeamPage() {
  return (
    <div className="anim-fade-in team-page-container">
      {/* Decorative ambient background elements */}
      <div className="team-ambient-glow team-ambient-glow--1"></div>
      <div className="team-ambient-glow team-ambient-glow--2"></div>

      <div className="team-hero">
        <h1 className="team-hero__title">Meet the Visionaries</h1>
        <p className="team-hero__subtitle">
          The brilliant minds engineering the future of the Smart Agriculture Data Platform.
        </p>
      </div>

      <div className="team-grid">
        {TEAM.map((member, i) => (
          <div
            className="team-card premium-glass anim-stagger"
            style={{ "--stagger-index": i }}
            key={member.name}
          >
            <div
              className="team-card__avatar-wrapper"
              style={{ background: member.gradient }}
            >
              <div className="team-card__avatar-inner">
                {member.name.charAt(0)}
              </div>
            </div>
            <div className="team-card__content">
              <h3 className="team-card__name">{member.name}</h3>
              <div className="team-card__role">{member.role}</div>
              <p className="team-card__bio">{member.bio}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
