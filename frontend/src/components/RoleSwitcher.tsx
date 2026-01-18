import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentRole, setRole, type Role } from '../utils/role';
import './RoleSwitcher.css';

/**
 * Toggle for switching between player and GM roles.
 * Shown in development, or in production when VITE_SHOW_ROLE_SWITCHER is enabled.
 */
export function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<Role>(getCurrentRole());
  const navigate = useNavigate();
  const location = useLocation();

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
  };

  // Show in development, or in production if VITE_SHOW_ROLE_SWITCHER is enabled
  const showInProd = import.meta.env.VITE_SHOW_ROLE_SWITCHER === 'true';
  if (import.meta.env.PROD && !showInProd) {
    return null;
  }

  const isOnAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="role-switcher">
      <span className="role-switcher-label">Role</span>
      <button
        className={`role-switcher-btn ${currentRole === 'player' ? 'active' : ''}`}
        onClick={() => handleRoleChange('player')}
      >
        Player
      </button>
      <button
        className={`role-switcher-btn ${currentRole === 'gm' ? 'active' : ''}`}
        onClick={() => handleRoleChange('gm')}
      >
        GM
      </button>
      {currentRole === 'gm' && !isOnAdminPage && (
        <>
          <div className="role-switcher-divider" />
          <button
            className="role-switcher-admin-btn"
            onClick={handleAdminClick}
            title="Go to Admin Panel"
          >
            ⚡ Admin
          </button>
        </>
      )}
    </div>
  );
}
