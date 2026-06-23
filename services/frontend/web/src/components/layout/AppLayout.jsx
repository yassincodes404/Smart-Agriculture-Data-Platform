/**
 * components/layout/AppLayout.jsx
 * --------------------------------
 * Root layout shell wrapping all protected pages.
 * Sidebar (left) + Topbar (top) + scrollable content area.
 */

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Topbar />
        <main className="app-shell__content">
          <div className="app-shell__content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}