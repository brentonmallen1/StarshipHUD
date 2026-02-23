import { useState, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import './Layout.css';

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu when navigating
  const handleNavClick = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Close menu when clicking outside (on overlay)
  const handleOverlayClick = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <div className="app-container admin-layout">
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <header className="admin-header">
        <h1 className="admin-title">Starship HUD - Admin</h1>

        {/* Version indicator */}
        <span className="admin-version">v{__APP_VERSION__}</span>

        {/* Hamburger button - visible on mobile */}
        <button
          type="button"
          className={`admin-menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {/* Overlay for closing menu on mobile */}
        {menuOpen && (
          <div className="admin-nav-overlay" onClick={handleOverlayClick} />
        )}

        <nav className={`admin-nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/admin" end className="admin-nav-link" onClick={handleNavClick}>
            Dashboards
          </NavLink>
          <NavLink to="/admin/panels" className="admin-nav-link" onClick={handleNavClick}>
            Panels
          </NavLink>
          <NavLink to="/admin/systems" className="admin-nav-link" onClick={handleNavClick}>
            Systems
          </NavLink>
          <NavLink to="/admin/assets" className="admin-nav-link" onClick={handleNavClick}>
            Weapons/Assets
          </NavLink>
          <NavLink to="/admin/cargo" className="admin-nav-link" onClick={handleNavClick}>
            Cargo
          </NavLink>
          <NavLink to="/admin/contacts" className="admin-nav-link" onClick={handleNavClick}>
            Contacts
          </NavLink>
          <NavLink to="/admin/crew" className="admin-nav-link" onClick={handleNavClick}>
            Crew
          </NavLink>
          <NavLink to="/admin/scenarios" className="admin-nav-link" onClick={handleNavClick}>
            Scenarios
          </NavLink>
          <NavLink to="/admin/transmissions" className="admin-nav-link" onClick={handleNavClick}>
            Transmissions
          </NavLink>
          <NavLink to="/admin/alerts" className="admin-nav-link" onClick={handleNavClick}>
            Alerts/Tasks
          </NavLink>
          <NavLink to="/admin/holomap" className="admin-nav-link" onClick={handleNavClick}>
            Holomap
          </NavLink>
          <NavLink to="/admin/sector-map" className="admin-nav-link" onClick={handleNavClick}>
            Sector Map
          </NavLink>
          <NavLink to="/admin/radar" className="admin-nav-link" onClick={handleNavClick}>
            Radar
          </NavLink>
          <NavLink to="/admin/media" className="admin-nav-link" onClick={handleNavClick}>
            Media
          </NavLink>
          <NavLink to="/" className="admin-nav-link player-link" onClick={handleNavClick}>
            Player View
          </NavLink>
        </nav>
      </header>
      <main id="main-content" className="main-content admin-content">
        <ErrorBoundary level="layout">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
