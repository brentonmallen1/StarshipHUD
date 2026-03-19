import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePanelsByStation, useMyShips } from '../hooks/useShipData';
import { useShipContext } from '../contexts/ShipContext';
import { useAuth } from '../contexts/AuthContext';
import { useIsGM } from '../contexts/RoleContext';
import { D20Loader } from './ui/D20Loader';
import type { Panel, StationGroup } from '../types';
import './Navigator.css';

const STATION_ICONS: Record<StationGroup, string> = {
  command: '⬡',
  engineering: '⚙',
  sensors: '◎',
  tactical: '⚔',
  life_support: '♡',
  communications: '⌘',
  operations: '⊞',
  admin: '⚡',
};

export function Navigator() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isGM = useIsGM();
  const { user, realUser, authEnabled, impersonation, logout, stopImpersonating } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: panelsByStation } = usePanelsByStation();
  const { data: myShips } = useMyShips();
  const { ship, shipId } = useShipContext();
  const currentPanelSlug = location.pathname.match(/\/panel\/([^/]+)/)?.[1];
  const hasMultipleShips = (myShips?.length ?? 0) > 1;

  const handlePanelClick = (panel: Panel) => {
    navigate(`/${shipId}/panel/${panel.slug}`);
    setIsOpen(false);
  };

  const handleAdminClick = () => {
    navigate(`/${shipId}/admin`);
    setIsOpen(false);
  };

  const handleSwitchShip = () => {
    navigate('/ships');
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsOpen(false);
  };

  const stations = panelsByStation
    ? (Object.keys(panelsByStation) as StationGroup[]).filter((s) => s !== 'admin')
    : [];

  return (
    <div
      ref={containerRef}
      className={`navigator ${isOpen ? 'open' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className="navigator-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Station Navigator"
        aria-label={isOpen ? 'Close station navigator' : 'Open station navigator'}
        aria-expanded={isOpen}
        aria-controls="navigator-menu"
      >
        <D20Loader size={42} speed={5} animate={isHovered || isOpen} />
      </button>

      {isOpen && (
        <nav id="navigator-menu" className="navigator-menu" aria-label="Station navigation">
          {/* Impersonation Banner */}
          {impersonation && realUser && (
            <div className="navigator-section navigator-impersonation">
              <div className="impersonation-banner">
                <span className="impersonation-label">Viewing as</span>
                <span className="impersonation-user">{impersonation.displayName}</span>
                <span className="impersonation-role">{impersonation.role}</span>
              </div>
              <div className="impersonation-admin">
                Assumed by {realUser.display_name}
              </div>
              <button
                className="navigator-stop-impersonating-btn"
                onClick={stopImpersonating}
              >
                Stop Impersonating
              </button>
            </div>
          )}

          {/* User Info (when auth is enabled and not impersonating) */}
          {authEnabled && user && !impersonation && (
            <div className="navigator-section navigator-user-section">
              <div className="navigator-section-label">Operator</div>
              <div className="navigator-user-info">
                <span className="user-name">{user.display_name}</span>
                <span className="user-role">{user.role}</span>
              </div>
              <button
                className="navigator-logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}

          {/* Current Ship Indicator (only show if multiple ships accessible) */}
          {ship && hasMultipleShips && (
            <div className="navigator-section navigator-ship-section">
              <div className="navigator-section-label">Current Ship</div>
              <div className="navigator-ship-info">
                <span className="ship-name">{ship.name}</span>
                {ship.ship_class && (
                  <span className="ship-class">{ship.ship_class}</span>
                )}
              </div>
              <button
                className="navigator-switch-btn"
                onClick={handleSwitchShip}
              >
                Switch Ship
              </button>
            </div>
          )}

          {/* Admin Panel button for GM/Admin users */}
          {isGM && (
            <div className="navigator-section navigator-admin-section">
              <button
                className="navigator-admin-btn"
                onClick={handleAdminClick}
              >
                Admin Panel
              </button>
            </div>
          )}

          {/* Panels List */}
          <div className="navigator-section">
            <div className="navigator-section-label" id="panels-label">Panels</div>
            <div className="navigator-panel-list" role="list" aria-labelledby="panels-label">
              {stations.flatMap((station) =>
                panelsByStation?.[station]?.map((panel: Panel) => (
                  <button
                    key={panel.id}
                    role="listitem"
                    className={`navigator-panel ${panel.slug === currentPanelSlug ? 'active' : ''}`}
                    onClick={() => handlePanelClick(panel)}
                    aria-label={`Navigate to ${panel.name} panel in ${station} station`}
                    aria-current={panel.slug === currentPanelSlug ? 'page' : undefined}
                  >
                    <span className="panel-icon" aria-hidden="true">{STATION_ICONS[station]}</span>
                    <span className="panel-name">{panel.name}</span>
                  </button>
                )) || []
              )}
            </div>
          </div>

          {/* Version Footer */}
          <div className="navigator-version" aria-label={`Version ${__APP_VERSION__}`}>v{__APP_VERSION__}</div>
        </nav>
      )}
    </div>
  );
}
