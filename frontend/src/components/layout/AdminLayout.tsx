import { useState, useCallback, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useShipContext } from '../../contexts/ShipContext';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorBoundary } from '../ErrorBoundary';
import './Layout.css';

interface NavGroup {
  label: string;
  links: { to: string; label: string; end?: boolean }[];
}

function getNavGroups(shipId: string): NavGroup[] {
  const base = `/${shipId}/admin`;
  return [
    {
      label: 'HUD',
      links: [
        { to: base, label: 'Dashboards', end: true },
        { to: `${base}/panels`, label: 'Panels' },
      ],
    },
    {
      label: 'Vessel',
      links: [
        { to: `${base}/systems`, label: 'Systems' },
        { to: `${base}/assets`, label: 'Assets' },
        { to: `${base}/cargo`, label: 'Cargo' },
      ],
    },
    {
      label: 'Personnel',
      links: [
        { to: `${base}/crew`, label: 'Crew' },
        { to: `${base}/contacts`, label: 'Contacts' },
      ],
    },
    {
      label: 'Tactical',
      links: [
        { to: `${base}/holomap`, label: 'Holomap' },
        { to: `${base}/sector-map`, label: 'Sector Map' },
        { to: `${base}/radar`, label: 'Radar' },
      ],
    },
    {
      label: 'Comms',
      links: [
        { to: `${base}/scenarios`, label: 'Scenarios' },
        { to: `${base}/transmissions`, label: 'Transmissions' },
        { to: `${base}/alerts`, label: 'Alerts/Tasks' },
        { to: `${base}/timers`, label: 'Timers' },
      ],
    },
    {
      label: 'Config',
      links: [
        { to: `${base}/media`, label: 'Media' },
        { to: `${base}/ships`, label: 'Ships' },
        { to: `${base}/users`, label: 'Users' },
        { to: `${base}/settings`, label: 'Settings' },
      ],
    },
  ];
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { shipId } = useShipContext();
  const { user, authEnabled, logout } = useAuth();

  const navGroups = useMemo(() => getNavGroups(shipId ?? ''), [shipId]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

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

        {/* User info and logout */}
        {authEnabled && user && (
          <div className="admin-user-info">
            <span className="admin-user-name">{user.display_name}</span>
            <button className="admin-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}

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
          {navGroups.map((group) => (
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
          <NavLink to={`/${shipId}/panels`} className="admin-nav-link player-link" onClick={handleNavClick}>
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
