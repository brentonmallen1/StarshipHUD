import { useState, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { GMToolbar } from '../admin/GMToolbar';
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
      <header className="admin-header">
        <h1 className="admin-title">Starship HUD - Admin</h1>

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
            Dashboard
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
          <NavLink to="/admin/radar" className="admin-nav-link" onClick={handleNavClick}>
            Radar
          </NavLink>
          <NavLink to="/" className="admin-nav-link player-link" onClick={handleNavClick}>
            Player View
          </NavLink>
        </nav>
      </header>
      <GMToolbar />
      <main className="main-content admin-content">
        <Outlet />
      </main>
    </div>
  );
}
