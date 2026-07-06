/**
 * components/layout/Topbar.jsx
 * ---------------------------
 * Top navigation bar with page title and user actions.
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listLands } from "../../services/api";
import { useNotifications } from "../../context/NotificationContext";

/** Map pathnames to readable page titles */
const PAGE_TITLES = {
  "/dashboard":   "Dashboard",
  "/lands":       "Lands Explorer",
  "/lands/new":   "Add New Land",
  "/methodology": "Data & Methodology",
  "/team":        "Our Team",
  "/about":       "About the Project",
  "/profile":     "My Profile",
  "/logs":        "Activity Logs",
};

export default function Topbar({ onToggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, loadServerNotifications, addNotification, clearAll } = useNotifications();

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lands, setLands] = useState([]);
  const [landsLoading, setLandsLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);

  /** Resolve page title from pathname */
  const getTitle = () => {
    if (PAGE_TITLES[location.pathname]) return PAGE_TITLES[location.pathname];
    if (location.pathname.startsWith("/lands/")) return "Land Details";
    return "Dashboard";
  };

  // Close panels on route change or ESC
  useEffect(() => {
    setSearchOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen, notifOpen]);

  // Open search: fetch lands once
  const openSearch = async () => {
    setNotifOpen(false);
    const next = !searchOpen;
    setSearchOpen(next);
    if (next && lands.length === 0) {
      setLandsLoading(true);
      try {
        const res = await listLands();
        const items = res?.lands || res?.data?.lands || [];
        setLands(items);
      } catch (err) {
        setLands([]);
      } finally {
        setLandsLoading(false);
      }
    }
  };

  // Open notifs: refresh from server + ui
  const openNotifs = async () => {
    setSearchOpen(false);
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      setNotifLoading(true);
      try {
        await loadServerNotifications();
      } finally {
        setNotifLoading(false);
      }
    }
  };

  // Filter lands for search
  const filteredLands = searchQuery.trim()
    ? lands.filter((l) =>
        (l.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(l.land_id || "").includes(searchQuery)
      )
    : lands.filter(l => {
        const s = (l.status || "").toLowerCase();
        return !s.includes("error") && !s.includes("fail") && !s.includes("not found");
      }).slice(0, 6);

  const getStatusColor = (status) => {
    if (!status) return "var(--info)";
    const s = status.toLowerCase();
    if (s.includes("error") || s.includes("fail") || s.includes("not found")) return "var(--error)";
    if (s.includes("processing") || s.includes("step") || s.includes("fetch")) return "var(--warning)";
    return "var(--success)";
  };

  const goToLand = (landId) => {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/lands/${landId}`);
  };

  // Notification helpers
  const unreadCount = notifications.length;
  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const handleNotifClick = (n) => {
    setNotifOpen(false);
    if (n.land_id) {
      navigate(`/lands/${n.land_id}`);
    }
  };



  const handleClear = () => {
    clearAll();
    setTimeout(() => addNotification({ type: "system", message: "Notifications cleared. New alerts will appear here." }), 120);
  };

  return (
    <header className="topbar" id="app-topbar">
      <div className="topbar__left" style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
        <button
          className="topbar__icon-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          style={{ marginRight: 8 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="topbar__page-title">{getTitle()}</h1>
      </div>

      <div className="topbar__right">
        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            className="topbar__icon-btn"
            aria-label="Notifications"
            title="Notifications"
            id="topbar-notifications"
            onClick={openNotifs}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="topbar__notification-dot"
                style={{
                  background: "var(--error)",
                  width: unreadCount > 9 ? 16 : 10,
                  height: unreadCount > 9 ? 16 : 10,
                  fontSize: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  border: "1.5px solid var(--bg-primary)",
                }}
              >
                {unreadCount > 9 ? "9+" : null}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notifOpen && (
            <div className="topbar__notif-dropdown">
              <div className="topbar__notif-header">
                <span>Notifications</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{notifications.length} total</span>
              </div>

              <div className="topbar__notif-list">
                {notifLoading && <div className="topbar__notif-empty">Loading alerts...</div>}

                {!notifLoading && notifications.length === 0 && (
                  <div className="topbar__notif-empty">
                    No alerts yet.<br />UI actions and backend monitoring will add messages here.
                  </div>
                )}

                {!notifLoading && notifications.map((n) => (
                  <div
                    key={n.id}
                    className="topbar__notif-item"
                    onClick={() => handleNotifClick(n)}
                    title={n.land_id ? `Go to land #${n.land_id}` : "View details"}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>
                      <span className="notif-type">{(n.alert_type || n.type || "alert").replace(/_/g, " ")}</span>
                      <span className="notif-msg">{n.message || n.msg || "Alert"}</span>
                      <span className="notif-time">{formatTime(n.timestamp)}</span>
                      {n.land_id && <span style={{ fontSize: 11, opacity: 0.7 }}> • land {n.land_id}</span>}
                    </span>
                    {n.land_id && (
                      <span style={{ color: "var(--green-600)", fontSize: 16, marginLeft: 8, flexShrink: 0 }}>→</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="topbar__notif-footer">
                <button className="topbar__notif-btn" onClick={handleClear}>Clear</button>
                <button className="topbar__notif-btn" onClick={() => { setNotifOpen(false); loadServerNotifications(); }}>Refresh</button>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          <button
            className="topbar__icon-btn"
            aria-label="Search"
            title="Search lands"
            id="topbar-search"
            onClick={openSearch}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* Search Panel */}
          {searchOpen && (
            <div className="topbar__search-panel">
              <div className="topbar__search-header">
                <input
                  className="topbar__search-input"
                  placeholder="Search lands by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1, color: "var(--gray-500)" }}
                  aria-label="Close search"
                >
                  ×
                </button>
              </div>

              <div className="topbar__search-results">
                {landsLoading && <div className="topbar__search-empty">Loading lands...</div>}

                {!landsLoading && filteredLands.length === 0 && (
                  <div className="topbar__search-empty">
                    {searchQuery ? `No lands match "${searchQuery}"` : "No lands found. Create one first."}
                  </div>
                )}

                {!landsLoading && filteredLands.map((land) => (
                  <div
                    key={land.land_id}
                    className="topbar__search-result"
                    onClick={() => goToLand(land.land_id)}
                    style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px" }}
                  >
                    <div 
                      style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: "50%", 
                        backgroundColor: getStatusColor(land.status),
                        flexShrink: 0
                      }} 
                    />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <span className="land-name" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {land.name || `Land #${land.land_id}`}
                      </span>
                      <span className="land-meta" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <span style={{ textTransform: "capitalize" }}>{(land.status || "active").split(':')[0]}</span> 
                        {land.area_hectares ? ` • ${land.area_hectares} ha` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
