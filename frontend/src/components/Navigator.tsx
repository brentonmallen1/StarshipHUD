import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePanelsByStation } from '../hooks/useShipData';
import { useShipContext } from '../contexts/ShipContext';
import { getCurrentRole, setRole, type Role } from '../utils/role';
import { isGM } from '../utils/role';
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
  const [currentRole, setCurrentRole] = useState<Role>(getCurrentRole());
  const containerRef = useRef<HTMLDivElement>(null);

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
  const { ship } = useShipContext();

  const currentPanelId = location.pathname.match(/\/panel\/(\w+)/)?.[1];

  // Find current station
  let currentStation: StationGroup | undefined;
  if (panelsByStation && currentPanelId) {
    for (const [station, panels] of Object.entries(panelsByStation)) {
      if (panels.some((p: Panel) => p.id === currentPanelId)) {
        currentStation = station as StationGroup;
        break;
      }
    }
  }

  const handlePanelClick = (panel: Panel) => {
    navigate(`/panel/${panel.id}`);
    setIsOpen(false);
  };

  const handleRoleChange = (newRole: Role) => {
    // Check if we're on a panel page BEFORE changing anything
    const playerPanelMatch = location.pathname.match(/^\/panel\/([^/]+)$/);
    const adminPanelMatch = location.pathname.match(/^\/admin\/panels\/([^/]+)$/);

    // Store role in localStorage
    localStorage.setItem('starship-hud-role', newRole);
    setCurrentRole(newRole);

    if (newRole === 'gm' && playerPanelMatch) {
      // Switching to GM while on player panel view → go to admin panel edit
      const panelId = playerPanelMatch[1];
      window.location.href = `/admin/panels/${panelId}?role=${newRole}`;
      return;
    }

    if (newRole === 'player' && adminPanelMatch) {
      // Switching to Player while on admin panel edit → go to player panel view
      const panelId = adminPanelMatch[1];
      window.location.href = `/panel/${panelId}?role=${newRole}`;
      return;
    }

    // Default: update URL and reload to apply role changes
    setRole(newRole);
    window.location.reload();
  };

  const handleAdminClick = () => {
    navigate('/admin');
    setIsOpen(false);
  };

  const handleSwitchShip = () => {
    navigate('/ships');
    setIsOpen(false);
  };

  const stations = panelsByStation
    ? (Object.keys(panelsByStation) as StationGroup[]).filter((s) => s !== 'admin')
    : [];

  return (
    <div ref={containerRef} className={`navigator ${isOpen ? 'open' : ''}`}>
      <button
        className="navigator-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Station Navigator"
      >
        <span className="navigator-icon">
          {currentStation ? STATION_ICONS[currentStation] : '◈'}
        </span>
      </button>

      {isOpen && (
        <div className="navigator-menu">
          {/* Current Ship Indicator */}
          {ship && (
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

          {/* Role Switcher - shown in dev or when VITE_SHOW_ROLE_SWITCHER is enabled */}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_ROLE_SWITCHER === 'true') && (
            <div className="navigator-section navigator-role-section">
              <div className="navigator-section-label">Role</div>
              <div className="navigator-role-buttons">
                <button
                  className={`navigator-role-btn ${currentRole === 'player' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('player')}
                >
                  Player
                </button>
                <button
                  className={`navigator-role-btn ${currentRole === 'gm' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('gm')}
                >
                  GM
                </button>
              </div>
              {isGM() && (
                <button
                  className="navigator-admin-btn"
                  onClick={handleAdminClick}
                >
                  Admin Panel
                </button>
              )}
            </div>
          )}

          {/* Panels List */}
          <div className="navigator-section">
            <div className="navigator-section-label">Panels</div>
            <div className="navigator-panel-list">
              {stations.flatMap((station) =>
                panelsByStation?.[station]?.map((panel: Panel) => (
                  <button
                    key={panel.id}
                    className={`navigator-panel ${panel.id === currentPanelId ? 'active' : ''}`}
                    onClick={() => handlePanelClick(panel)}
                  >
                    <span className="panel-icon">{STATION_ICONS[station]}</span>
                    <span className="panel-name">{panel.name}</span>
                  </button>
                )) || []
              )}
            </div>
          </div>

          {/* Version Footer */}
          <div className="navigator-version">v{__APP_VERSION__}</div>
        </div>
      )}
    </div>
  );
}
