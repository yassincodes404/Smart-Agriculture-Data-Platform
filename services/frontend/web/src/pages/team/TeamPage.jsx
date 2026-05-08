/**
 * pages/team/TeamPage.jsx
 * -----------------------
 * Showcase the team members.
 */

import "../Pages.css";

const TEAM = [
  { name: "Yassin Tarek",     role: "Project Lead & Backend Developer",  bio: "Responsible for system architecture, FastAPI backend, and data pipeline integration.", gradient: "linear-gradient(135deg, #16a34a, #15803d)" },
  { name: "Team Member 2",    role: "Frontend Developer",               bio: "Implements the React/Vite frontend, dashboard UI, and satellite viewer components.", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)" },
  { name: "Team Member 3",    role: "Data Analyst",                     bio: "Handles geospatial data processing, NDVI calculations, and soil analysis pipelines.", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { name: "Team Member 4",    role: "Database Engineer",                bio: "Designs and maintains MySQL schemas, query optimization, and data integrity.", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
];

export default function TeamPage() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Our Team</h1>
        <p className="page-header__subtitle">
          Meet the people behind the Smart Agriculture Data Platform.
        </p>
      </div>

      <div className="grid-4">
        {TEAM.map((member, i) => (
          <div className="team-card anim-stagger" style={{ "--stagger-index": i }} key={member.name}>
            <div className="team-card__avatar" style={{ background: member.gradient }}>
              {member.name.charAt(0)}
            </div>
            <div className="team-card__name">{member.name}</div>
            <div className="team-card__role">{member.role}</div>
            <p className="team-card__bio">{member.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}