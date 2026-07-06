/**
 * components/layout/AppLayout.jsx
 * --------------------------------
 * Root layout shell wrapping all protected pages.
 * Sidebar (left) + Topbar (top) + scrollable content area.
 */

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Robust mobile detection and initial state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // On mobile, start closed; on desktop start open
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={`app-shell ${!isSidebarOpen ? "app-shell--collapsed" : ""}`}>
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      {/* Mobile drawer overlay - visible when drawer open. Positioned below topbar via CSS */}
      {isSidebarOpen && isMobile && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <div className="app-shell__main">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="app-shell__content">
          <div className="app-shell__content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}