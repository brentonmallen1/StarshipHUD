import { useState, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorBoundary';
import './Layout.css';

interface NavGroup {
  label: string;
  links: { to: string; label: string; end?: boolean }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'HUD',
    links: [
      { to: '/admin', label: 'Dashboards', end: true },
      { to: '/admin/panels', label: 'Panels' },
    ],
  },
  {
    label: 'Vessel',
    links: [
      { to: '/admin/systems', label: 'Systems' },
      { to: '/admin/assets', label: 'Assets' },
      { to: '/admin/cargo', label: 'Cargo' },
    ],
  },
  {
    label: 'Personnel',
    links: [
      { to: '/admin/crew', label: 'Crew' },
      { to: '/admin/contacts', label: 'Contacts' },
    ],
  },
  {
    label: 'Tactical',
    links: [
      { to: '/admin/holomap', label: 'Holomap' },
      { to: '/admin/sector-map', label: 'Sector Map' },
      { to: '/admin/radar', label: 'Radar' },
    ],
  },
  {
    label: 'Comms',
    links: [
      { to: '/admin/scenarios', label: 'Scenarios' },
      { to: '/admin/transmissions', label: 'Transmissions' },
      { to: '/admin/alerts', label: 'Alerts/Tasks' },
      { to: '/admin/timers', label: 'Timers' },
    ],
  },
  {
    label: 'Config',
    links: [
      { to: '/admin/media', label: 'Media' },
      { to: '/admin/ships', label: 'Ships' },
      { to: '/admin/settings', label: 'Settings' },
    ],
  },
];

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Check if any link in a group matches the current path
  const isGroupActive = useCallback((group: NavGroup) => {
    return group.links.some((link) => {
      if (link.end) {
        return location.pathname === link.to;
      }
      return location.pathname.startsWith(link.to);
    });
  }, [location.pathname]);

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
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className={`admin-nav-group ${isGroupActive(group) ? 'active' : ''}`}>
              {/* Desktop: hover trigger */}
              <span className="admin-nav-group-trigger">
                {group.label}
                <span className="dropdown-arrow">▾</span>
              </span>
              {/* Desktop: dropdown menu */}
              <div className="admin-nav-group-dropdown">
                {group.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className="admin-nav-link"
                    onClick={handleNavClick}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
              {/* Mobile: section header + inline links */}
              <span className="admin-nav-group-header">{group.label}</span>
              <div className="admin-nav-group-links">
                {group.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className="admin-nav-link"
                    onClick={handleNavClick}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
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
