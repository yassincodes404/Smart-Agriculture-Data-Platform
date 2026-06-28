/**
 * pages/profile/ProfilePage.jsx
 * -----------------------------
 * User profile with account info and real land statistics.
 */

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { listLands } from "../../services/api";
import "../Pages.css";

export default function ProfilePage() {
  const { user } = useAuth();
  const [lands, setLands] = useState([]);
  const [loadingLands, setLoadingLands] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadLands() {
      try {
        const res = await listLands();
        if (active) setLands(res.lands || []);
      } catch {
        if (active) setLands([]);
      } finally {
        if (active) setLoadingLands(false);
      }
    }

    loadLands();
    return () => {
      active = false;
    };
  }, []);

  const initials = user?.email ? user.email.charAt(0).toUpperCase() : "?";
  const displayName = user?.email?.split("@")[0] || "User";

  const totalArea = useMemo(
    () => lands.reduce((sum, land) => sum + Number(land.area_hectares || 0), 0),
    [lands]
  );

  const recentActivity = useMemo(
    () =>
      lands
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map((land) => ({
          action: `Registered land ${land.name}`,
          time: new Date(land.created_at).toLocaleDateString(),
          type: land.status === "error" ? "warning" : "success",
        })),
    [lands]
  );

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : "Not available";

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">My Profile</h1>
        <p className="page-header__subtitle">
          Review your account and the land records connected to it.
        </p>
      </div>

      <div className="profile-section">
        <div className="profile-sidebar anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="profile-avatar">{initials}</div>
          <div className="profile-name">{displayName}</div>
          <div className="profile-email">{user?.email || "-"}</div>
          <span className="badge badge--healthy" style={{ marginBottom: "var(--space-md)" }}>
            {user?.role || "viewer"}
          </span>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat__value">{loadingLands ? "..." : lands.length}</div>
              <div className="profile-stat__label">Lands</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat__value">
                {loadingLands ? "..." : totalArea.toFixed(1)}
              </div>
              <div className="profile-stat__label">Total ha</div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-header__title">Account Information</h2>
          </div>
          <div
            className="card card--no-hover anim-stagger"
            style={{ "--stagger-index": 1, marginBottom: "var(--space-xl)" }}
          >
            <div className="grid-2" style={{ gap: "var(--space-lg)" }}>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Email</div>
                <div className="text-body">{user?.email || "-"}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Role</div>
                <div className="text-body" style={{ textTransform: "capitalize" }}>
                  {user?.role || "viewer"}
                </div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Member Since</div>
                <div className="text-body">{memberSince}</div>
              </div>
              <div>
                <div className="text-overline" style={{ marginBottom: "var(--space-xs)" }}>Tracking Frequency</div>
                <div className="text-body">Per land setting</div>
              </div>
            </div>
          </div>

          <div className="section-header">
            <h2 className="section-header__title">Recent Activity</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {recentActivity.length === 0 && (
              <div className="card card--no-hover" style={{ padding: "var(--space-md)" }}>
                <span className="text-body-sm">
                  {loadingLands ? "Loading activity..." : "No land activity yet."}
                </span>
              </div>
            )}

            {recentActivity.map((item, i) => (
              <div
                className="card card--no-hover anim-stagger"
                style={{
                  "--stagger-index": i + 2,
                  padding: "var(--space-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-md)",
                }}
                key={`${item.action}-${item.time}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <div
                    className={`logs-table__dot logs-table__dot--${item.type}`}
                    style={{ width: 8, height: 8, borderRadius: "50%" }}
                  />
                  <span className="text-body-sm" style={{ color: "var(--text-primary)" }}>
                    {item.action}
                  </span>
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
