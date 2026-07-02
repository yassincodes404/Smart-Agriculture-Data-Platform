/**
 * pages/logs/LogsPage.jsx
 * -----------------------
 * Activity logs and pipeline monitoring.
 */

import "../Pages.css";

const LOGS = [
  { id: "PL-001", action: "Land analysis pipeline",  target: "Al Fayyum — Plot B",     status: "success", time: "2026-05-08 09:23:41", duration: "12.4s" },
  { id: "PL-002", action: "Satellite image fetch",   target: "Nile Delta Region 3",    status: "success", time: "2026-05-08 08:15:02", duration: "8.2s" },
  { id: "PL-003", action: "NDVI calculation",        target: "Alexandria Coastal",     status: "error",   time: "2026-05-08 07:45:18", duration: "—" },
  { id: "PL-004", action: "Soil data integration",   target: "Aswan — South Bank",     status: "success", time: "2026-05-07 22:10:33", duration: "5.1s" },
  { id: "PL-005", action: "Climate data sync",       target: "All Governorates",       status: "success", time: "2026-05-07 18:00:00", duration: "45.8s" },
  { id: "PL-006", action: "Land analysis pipeline",  target: "Minya Agricultural",     status: "warning", time: "2026-05-07 14:30:12", duration: "28.3s" },
  { id: "PL-007", action: "User registration",       target: "analyst@agri.eg",        status: "success", time: "2026-05-07 11:22:05", duration: "0.3s" },
  { id: "PL-008", action: "Satellite image fetch",   target: "Sharqia — East Delta",   status: "success", time: "2026-05-06 20:45:01", duration: "6.7s" },
  { id: "PL-009", action: "Land analysis pipeline",  target: "Beheira Province",       status: "error",   time: "2026-05-06 16:12:44", duration: "—" },
  { id: "PL-010", action: "Export report",            target: "Monthly — All Lands",    status: "success", time: "2026-05-06 09:00:00", duration: "3.2s" },
];

const STATUS_LABELS = {
  success: "Completed",
  error: "Failed",
  warning: "Partial",
};

export default function LogsPage() {
  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h1 className="page-header__title">Activity Logs</h1>
        <p className="page-header__subtitle">
          Monitor pipeline executions, system events, and processing history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card stat-card--green anim-stagger" style={{ "--stagger-index": 0 }}>
          <div className="stat-card__content">
            <div className="stat-card__value">247</div>
            <div className="stat-card__label">Total Events</div>
          </div>
        </div>
        <div className="stat-card stat-card--blue anim-stagger" style={{ "--stagger-index": 1 }}>
          <div className="stat-card__content">
            <div className="stat-card__value">98.2%</div>
            <div className="stat-card__label">Success Rate</div>
          </div>
        </div>
        <div className="stat-card stat-card--red anim-stagger" style={{ "--stagger-index": 2 }}>
          <div className="stat-card__content">
            <div className="stat-card__value">4</div>
            <div className="stat-card__label">Failed Tasks</div>
          </div>
        </div>
        <div className="stat-card stat-card--amber anim-stagger" style={{ "--stagger-index": 3 }}>
          <div className="stat-card__content">
            <div className="stat-card__value">8.4s</div>
            <div className="stat-card__label">Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card card--no-hover anim-stagger" style={{ "--stagger-index": 4, padding: 0, overflow: 'hidden' }}>
        <table className="logs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Action</th>
              <th>Target</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {LOGS.map((log) => (
              <tr key={log.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--gray-500)' }}>{log.id}</td>
                <td style={{ fontWeight: 500 }}>{log.action}</td>
                <td>{log.target}</td>
                <td>
                  <span className="logs-table__status">
                    <span className={`logs-table__dot logs-table__dot--${log.status}`} />
                    {STATUS_LABELS[log.status]}
                  </span>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{log.duration}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}