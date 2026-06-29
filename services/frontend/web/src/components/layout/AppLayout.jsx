/**
 * components/layout/AppLayout.jsx
 * --------------------------------
 * Root layout shell wrapping all protected pages.
 * Sidebar (left) + Topbar (top) + scrollable content area.
 */

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className={`app-shell ${!isSidebarOpen ? "app-shell--collapsed" : ""}`}>
      <Sidebar isOpen={isSidebarOpen} />
      <div className="app-shell__main">
        <Topbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="app-shell__content">
          <div className="app-shell__content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}