/**
 * context/NotificationContext.jsx
 * -------------------------------
 * Lightweight notification system for header bell + important UI messages.
 * - Pulls real alerts from backend LandAlert via /notifications
 * - Allows any UI code to push messages via addNotification (e.g. success, warnings, alerts)
 * - Notifications shown in Topbar dropdown.
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { listNotifications } from "../services/api";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add a UI-originated or mixed notification. 
  // These always "come from the UI" layer.
  const addNotification = useCallback((notif) => {
    const item = {
      id: `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      alert_type: notif.type || notif.alert_type || "ui_message",
      severity: notif.severity || "medium",
      message: notif.message || notif.text || "Notification",
      land_id: notif.land_id || notif.landId || null,
      source: "ui",
      ...notif,
    };
    setNotifications((prev) => [item, ...prev].slice(0, 30)); // cap
  }, []);

  // Load from backend (LandAlert system) and merge
  const loadServerNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotifications(12);
      const serverItems = (res?.data || []).map((a) => ({
        ...a,
        source: "server",
      }));
      // merge: keep recent UI ones on top, dedupe by id if overlap (prefer server for same)
      setNotifications((prev) => {
        const uiOnes = prev.filter((p) => p.source === "ui");
        const merged = [...serverItems, ...uiOnes];
        // simple unique by id or message+time
        const seen = new Set();
        const unique = [];
        for (const m of merged) {
          const key = m.id || `${m.land_id}-${m.timestamp}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(m);
          }
        }
        return unique.slice(0, 20);
      });
    } catch (e) {
      // non-fatal; keep what we have + ui ones
      // optionally surface a silent ui message
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed a couple of demo UI messages on first load so bell is never empty (from UI)
  useEffect(() => {
    // Only seed once if empty
    setNotifications((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: "ui-seed-1",
            timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
            alert_type: "ui_message",
            severity: "low",
            message: "Welcome! Notifications surface important alerts and UI messages here.",
            land_id: null,
            source: "ui",
          },
          {
            id: "ui-seed-2",
            timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            alert_type: "system",
            severity: "medium",
            message: "You can trigger test alerts from the bell menu.",
            land_id: null,
            source: "ui",
          },
        ];
      }
      return prev;
    });
    // Optionally load server ones shortly after mount (non blocking)
    const t = setTimeout(() => {
      loadServerNotifications();
    }, 800);
    return () => clearTimeout(t);
  }, [loadServerNotifications]);

  const clearAll = useCallback(() => setNotifications([]), []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = {
    notifications,
    loading,
    addNotification,
    loadServerNotifications,
    clearAll,
    removeNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Fallback no-op if provider missing (graceful)
    return {
      notifications: [],
      loading: false,
      addNotification: () => {},
      loadServerNotifications: async () => {},
      clearAll: () => {},
      removeNotification: () => {},
    };
  }
  return ctx;
}

export default NotificationContext;
