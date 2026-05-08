/**
 * components/layout/Topbar.jsx
 * ---------------------------
 * Top navigation bar with page title and user actions.
 */

import { useLocation } from "react-router-dom";

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

export default function Topbar() {
  const location = useLocation();

  /** Resolve page title from pathname */
  const getTitle = () => {
    // Direct match first
    if (PAGE_TITLES[location.pathname]) {
      return PAGE_TITLES[location.pathname];
    }
    // Dynamic route: /lands/:id
    if (location.pathname.startsWith("/lands/")) {
      return "Land Details";
    }
    return "Dashboard";
  };

  return (
    <header className="topbar" id="app-topbar">
      <div className="topbar__left">
        <h1 className="topbar__page-title">{getTitle()}</h1>
      </div>

      <div className="topbar__right">
        {/* Notification bell */}
        <button
          className="topbar__icon-btn"
          aria-label="Notifications"
          title="Notifications"
          id="topbar-notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="topbar__notification-dot" />
        </button>

        {/* Search */}
        <button
          className="topbar__icon-btn"
          aria-label="Search"
          title="Search"
          id="topbar-search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>
    </header>
  );
}