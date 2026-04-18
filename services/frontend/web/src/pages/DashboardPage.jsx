/**
 * pages/DashboardPage.jsx
 * -----------------------
 * Post-login landing page showing user info and platform overview.
 */

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPages.css";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__logo">
          <div className="dashboard__logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C16 2 6 10 6 18C6 23.5 10.5 28 16 28C21.5 28 26 23.5 26 18C26 10 16 2 16 2Z" fill="rgba(255,255,255,0.9)"/>
              <path d="M16 8C16 8 10 14 10 19C10 22.3 12.7 25 16 25C19.3 25 22 22.3 22 19C22 14 16 8 16 8Z" fill="rgba(255,255,255,0.5)"/>
            </svg>
          </div>
          AgriData Egypt
        </div>

        <div className="dashboard__user">
          <div className="dashboard__user-info">
            <div className="dashboard__user-email">{user?.email}</div>
            <div className="dashboard__user-role">{user?.role}</div>
          </div>
          <button className="btn btn--logout" onClick={handleLogout} id="logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="dashboard__content">
        <div className="dashboard__welcome">
          <h1>Welcome back 👋</h1>
          <p>Here's an overview of the Smart Agriculture Data Platform.</p>
        </div>

        <div className="dashboard__cards">
          <div className="dashboard__card">
            <div className="dashboard__card-icon dashboard__card-icon--green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3>Climate Data Pipeline</h3>
            <p>27 governorates with 5 years of temperature and humidity data. Pipeline fully operational.</p>
          </div>

          <div className="dashboard__card">
            <div className="dashboard__card-icon dashboard__card-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10M18 20V4M6 20v-4"/>
              </svg>
            </div>
            <h3>Agricultural Analytics</h3>
            <p>Crop production trends, water efficiency metrics, and yield predictions across regions.</p>
          </div>

          <div className="dashboard__card">
            <div className="dashboard__card-icon dashboard__card-icon--amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <h3>User Management</h3>
            <p>Role-based access control with admin, analyst, and viewer permissions. {user?.role === "admin" ? "You have full access." : ""}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
