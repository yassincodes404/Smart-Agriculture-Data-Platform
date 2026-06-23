/**
 * pages/profile/ProfilePage.jsx
 * -----------------------------
 * User profile with account info and statistics.
 */

import { useAuth } from "../../context/AuthContext";
import "../Pages.css";

export default function ProfilePage() {
  const { user } = useAuth();

  const getInitials = () => {
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">My Profile</h1>
        <p className="page-header__subtitle">
          Manage your account settings and view your activity.
        </p>
      </div>

      <div className="profile-section">
        {/* Sidebar */}
        <div className="profile-sidebar anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="profile-avatar">{getInitials()}</div>
          <div className="profile-name">{user?.email?.split("@")[0] || "User"}</div>
          <div className="profile-email">{user?.email || "—"}</div>
          <span className="badge badge--healthy" style={{ marginBottom: 'var(--space-md)' }}>
            {user?.role || "viewer"}
          </span>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat__value">12</div>
              <div className="profile-stat__label">Lands</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat__value">156</div>
              <div className="profile-stat__label">Total ha</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Account Info */}
          <div className="section-header">
            <h2 className="section-header__title">Account Information</h2>
            <button className="btn btn--secondary btn--sm">Edit Profile</button>
          </div>
          <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 1, marginBottom: 'var(--space-xl)' }}>
            <div className="grid-2" style={{ gap: 'var(--space-lg)' }}>
              <div>
                <div className="text-overline" style={{ marginBottom: 'var(--space-xs)' }}>Email</div>
                <div className="text-body">{user?.email || "—"}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: 'var(--space-xs)' }}>Role</div>
                <div className="text-body" style={{ textTransform: 'capitalize' }}>{user?.role || "viewer"}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: 'var(--space-xs)' }}>Member Since</div>
                <div className="text-body">December 2025</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: 'var(--space-xs)' }}>Tracking Frequency</div>
                <div className="text-body">Weekly</div>
              </div>
            </div>
          </div>

          {/* Activity Overview */}
          <div className="section-header">
            <h2 className="section-header__title">Recent Activity</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {[
              { action: "Analyzed land Al Fayyum — Plot B",    time: "2 hours ago",  type: "info" },
              { action: "Added new land Sharqia — East Delta", time: "1 day ago",    type: "success" },
              { action: "Updated crop type for Aswan plot",    time: "3 days ago",   type: "info" },
              { action: "Exported report for Nile Delta",      time: "5 days ago",   type: "info" },
            ].map((item, i) => (
              <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": i + 2, padding: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div className={`logs-table__dot logs-table__dot--${item.type}`} style={{ width: 8, height: 8, borderRadius: '50%' }} />
                  <span className="text-body-sm" style={{ color: 'var(--text-primary)' }}>{item.action}</span>
                </div>
                <span className="text-caption">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}